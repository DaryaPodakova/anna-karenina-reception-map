from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT.parent / "files_for_project"
LIVELIB_SOURCE = SOURCE_DIR / "литрес рецензии.txt"
KINOPOISK_SOURCE = SOURCE_DIR / "кинопоиск реаензии.txt"
REVIEWS_CSV = PROJECT_ROOT / "docs" / "data" / "reviews.csv"
MENTIONS_CSV = PROJECT_ROOT / "docs" / "data" / "mentions.csv"
PUBLIC_REVIEW_TEXTS = PROJECT_ROOT / "docs" / "data" / "review_texts.json"
OUTPUT_ROOT = PROJECT_ROOT / "local_evidence"
ORIGINALS_DIR = OUTPUT_ROOT / "source_originals"
FORMATTED_DIR = OUTPUT_ROOT / "formatted"

RU_MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_ru_date(value: str) -> str:
    match = re.search(r"(\d{1,2})\s+([а-яё]+)\s+(\d{4})", value.lower())
    if not match:
        return ""
    day, month_name, year = match.groups()
    month = RU_MONTHS.get(month_name)
    return f"{year}-{month:02d}-{int(day):02d}" if month else ""


def next_nonempty(lines: list[str], start: int, stop: int | None = None) -> tuple[int, str]:
    end = len(lines) if stop is None else stop
    for index in range(start, end):
        if lines[index].strip():
            return index, lines[index].strip()
    return end, ""


def previous_nonempty(lines: list[str], start: int) -> tuple[int, str]:
    for index in range(start, -1, -1):
        if lines[index].strip():
            return index, lines[index].strip()
    return -1, ""


def trim_lines(lines: list[str]) -> list[str]:
    result = [line.rstrip() for line in lines]
    while result and not result[0].strip():
        result.pop(0)
    while result and not result[-1].strip():
        result.pop()
    compact: list[str] = []
    previous_blank = False
    for line in result:
        blank = not line.strip()
        if blank and previous_blank:
            continue
        compact.append(line)
        previous_blank = blank
    return compact


def strip_trailing_platform_numbers(lines: list[str]) -> list[str]:
    result = trim_lines(lines)
    while result and re.fullmatch(r"[\d\s(),.KК]+", result[-1].strip()):
        result.pop()
        result = trim_lines(result)
    return result


def parse_livelib(path: Path) -> list[dict[str, object]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    starts = [index for index, line in enumerate(lines) if "Аватар пользователя" in line]
    records: list[dict[str, object]] = []
    for ordinal, start in enumerate(starts, start=1):
        end = starts[ordinal] if ordinal < len(starts) else len(lines)
        author_index, author = next_nonempty(lines, start + 1, end)
        date_index, raw_date = next_nonempty(lines, author_index + 1, end)
        friends_index = next(
            (index for index in range(date_index + 1, end) if lines[index].strip() == "В друзья"),
            date_index,
        )
        content_start = friends_index + 1
        content_end = end
        for index in range(content_start, end):
            value = lines[index].strip().lower()
            if value.startswith("like") or "понравилось" in value:
                content_end = index
                break
        body_lines = strip_trailing_platform_numbers(lines[content_start:content_end])
        records.append(
            {
                "source": "livelib",
                "author": author,
                "date": parse_ru_date(raw_date),
                "raw_date": raw_date,
                "raw_datetime": raw_date,
                "body": "\n".join(body_lines).strip(),
                "start_line": start + 1,
                "end_line": end,
                "ordinal": ordinal,
            }
        )
    return records


def parse_kinopoisk(path: Path) -> list[dict[str, object]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    markers = [
        index
        for index, line in enumerate(lines)
        if line.strip() == "рецензии оценки друзья фильмы звёзды"
    ]
    records: list[dict[str, object]] = []
    for ordinal, marker in enumerate(markers, start=1):
        _, author = previous_nonempty(lines, marker - 1)
        end = next(
            (index for index in range(marker + 1, len(lines)) if lines[index].startswith("прямая ссылка")),
            len(lines),
        )
        footer = lines[end] if end < len(lines) else ""
        datetime_match = re.search(
            r"(\d{1,2}\s+[а-яё]+\s+\d{4})\s*\|\s*(\d{2}:\d{2})",
            footer.lower(),
        )
        raw_date = datetime_match.group(1) if datetime_match else ""
        raw_time = datetime_match.group(2) if datetime_match else ""
        body_lines = [
            line
            for line in lines[marker + 1 : end]
            if not re.fullmatch(r"\s*\d+\s+из\s+10\s*", line, flags=re.IGNORECASE)
        ]
        body_lines = trim_lines(body_lines)
        records.append(
            {
                "source": "kinopoisk",
                "author": author,
                "date": parse_ru_date(raw_date),
                "raw_date": raw_date,
                "raw_datetime": f"{raw_date} {raw_time}".strip(),
                "body": "\n".join(body_lines).strip(),
                "start_line": marker - 1,
                "end_line": end + 1,
                "ordinal": ordinal,
            }
        )
    return records


def match_record(
    review: dict[str, str],
    records: list[dict[str, object]],
) -> dict[str, object]:
    exact = [
        record
        for record in records
        if record["author"] == review["author_name"]
        and (not record["date"] or record["date"] == review["review_date"])
    ]
    if len(exact) == 1:
        return exact[0]
    author_only = [record for record in records if record["author"] == review["author_name"]]
    if len(author_only) == 1:
        return author_only[0]
    raise RuntimeError(
        f"Cannot uniquely match {review['review_id']} / {review['author_name']}: "
        f"exact={len(exact)}, author_only={len(author_only)}"
    )


def md_escape(value: str) -> str:
    return (value or "—").replace("|", "\\|").replace("\n", " ")


def display_source(source: str) -> str:
    return {"livelib": "LiveLib", "kinopoisk": "Кинопоиск"}.get(source, source)


def display_object(object_type: str) -> str:
    return {"novel": "Роман", "film": "Фильм"}.get(object_type, object_type)


def original_link(review: dict[str, str]) -> str:
    filename = LIVELIB_SOURCE.name if review["source"] == "livelib" else KINOPOISK_SOURCE.name
    return f"[копия исходной выгрузки](<../../source_originals/{filename}>)"


def review_card(
    review: dict[str, str],
    record: dict[str, object],
    mentions: list[dict[str, str]],
    heading_level: int = 1,
) -> str:
    heading = "#" * heading_level
    subheading = "#" * (heading_level + 1)
    title = review["review_title"] or f"Отзыв {review['author_name']}"
    metadata = [
        ("review_id", f"`{review['review_id']}`"),
        ("Источник", display_source(review["source"])),
        ("Объект", display_object(review["object_type"])),
        ("Автор", review["author_name"] or "—"),
        ("Дата и время", str(record["raw_datetime"] or review["review_date"])),
        ("Рейтинг", review["rating"] or "не указан"),
        ("Лайки / полезные голоса", review["likes_count"] or "не указаны"),
        ("Название", review["review_title"] or "без отдельного заголовка"),
        ("Режим отзыва", f"`{review['review_mode']}`"),
        ("Аналитическая ценность", f"`{review['analytical_value']}`"),
        (
            "Положение в сыром файле",
            f"строки {record['start_line']}–{record['end_line']}, блок {record['ordinal']}; {original_link(review)}",
        ),
    ]
    metadata_table = "\n".join(
        ["| Поле | Значение |", "|---|---|"]
        + [f"| {md_escape(key)} | {md_escape(value)} |" for key, value in metadata]
    )
    mention_heading = "#" * (heading_level + 2)
    mention_blocks: list[str] = []
    for mention in mentions:
        mention_blocks.append(
            f"{mention_heading} `{mention['mention_id']}` — {mention['segment_topic']}\n\n"
            f"- **Сущность:** {mention['entity_name']} (`{mention['entity_type']}`)\n"
            f"- **Объект оценки:** `{mention['evaluation_target']}`\n"
            f"- **Рецептивная рамка:** `{mention['reception_frame']}`\n"
            f"- **Режим сравнения:** `{mention['comparison_mode']}`\n"
            f"- **Происхождение сцены:** `{mention['scene_origin']}`\n"
            f"- **Тон:** `{mention['sentiment']}`\n"
            f"- **Evidence short:** {mention['evidence_short']}\n"
            f"- **Confidence:** `{mention['confidence']}`\n"
            f"- **Coder notes:** {mention['coder_notes'] or 'нет'}"
        )
    body = str(record["body"]).strip()
    return (
        f"{heading} {title}\n\n"
        "> Локальная исследовательская копия полного публичного отзыва и связанной разметки.\n\n"
        f"{subheading} Карточка отзыва\n\n{metadata_table}\n\n"
        f"{subheading} 1. Оригинальное впечатление автора\n\n{body}\n\n"
        f"{subheading} 2. Наша текущая оценка\n\n"
        f"Отзыв получил `analytical_value={review['analytical_value']}` и режим "
        f"`review_mode={review['review_mode']}`. Ниже приведены все смысловые упоминания, "
        "которые сейчас используются в публичном CSV.\n\n"
        f"{subheading} 3. Размеченные смысловые упоминания\n\n"
        + "\n\n".join(mention_blocks)
        + "\n"
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_index(
    paired: list[tuple[dict[str, str], dict[str, object]]],
    mentions_by_review: dict[str, list[dict[str, str]]],
) -> None:
    lines = [
        "# Индекс локальных доказательств",
        "",
        "> Полные тексты хранятся вне `docs` и исключены из Git. Не публиковать без отдельной проверки прав и необходимости.",
        "",
        f"Отзывов: **{len(paired)}**. Смысловых упоминаний: **{sum(len(mentions_by_review[r['review_id']]) for r, _ in paired)}**.",
        "",
        "- [Все выбранные отзывы одним файлом](all_selected_reviews.md)",
        f"- [Исходная выгрузка LiveLib](<../source_originals/{LIVELIB_SOURCE.name}>)",
        f"- [Исходная выгрузка Кинопоиска](<../source_originals/{KINOPOISK_SOURCE.name}>)",
        "",
    ]
    for object_type, title, folder in (
        ("novel", "Отзывы о романе", "novel"),
        ("film", "Отзывы о фильме", "film"),
    ):
        lines.extend(
            [
                f"## {title}",
                "",
                "| ID | Автор | Дата / время | Рейтинг | Лайки | Упоминания | Карточка |",
                "|---|---|---|---:|---:|---:|---|",
            ]
        )
        for review, record in paired:
            if review["object_type"] != object_type:
                continue
            card_path = f"{folder}/{review['review_id']}.md"
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"`{review['review_id']}`",
                        md_escape(review["author_name"]),
                        md_escape(str(record["raw_datetime"] or review["review_date"])),
                        md_escape(review["rating"] or "—"),
                        md_escape(review["likes_count"] or "—"),
                        str(len(mentions_by_review[review["review_id"]])),
                        f"[открыть]({card_path})",
                    ]
                )
                + " |"
            )
        lines.append("")
    (FORMATTED_DIR / "index.md").write_text("\n".join(lines), encoding="utf-8")


def build() -> None:
    reviews = read_csv(REVIEWS_CSV)
    mentions = read_csv(MENTIONS_CSV)
    mentions_by_review: dict[str, list[dict[str, str]]] = defaultdict(list)
    for mention in mentions:
        mentions_by_review[mention["review_id"]].append(mention)

    livelib_records = parse_livelib(LIVELIB_SOURCE)
    kinopoisk_records = parse_kinopoisk(KINOPOISK_SOURCE)
    parsed_by_source = {"livelib": livelib_records, "kinopoisk": kinopoisk_records}

    paired: list[tuple[dict[str, str], dict[str, object]]] = []
    for review in reviews:
        record = match_record(review, parsed_by_source[review["source"]])
        if not str(record["body"]).strip():
            raise RuntimeError(f"Empty original body for {review['review_id']}")
        paired.append((review, record))

    if len(paired) != 24:
        raise RuntimeError(f"Expected 24 selected reviews, got {len(paired)}")
    if sum(len(mentions_by_review[review["review_id"]]) for review, _ in paired) != 80:
        raise RuntimeError("Selected review cards do not cover all 80 mentions")

    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    ORIGINALS_DIR.mkdir(parents=True)
    (FORMATTED_DIR / "novel").mkdir(parents=True)
    (FORMATTED_DIR / "film").mkdir(parents=True)

    for source in (LIVELIB_SOURCE, KINOPOISK_SOURCE):
        shutil.copy2(source, ORIGINALS_DIR / source.name)

    checksums = []
    for source in (LIVELIB_SOURCE, KINOPOISK_SOURCE):
        copied = ORIGINALS_DIR / source.name
        if source.read_bytes() != copied.read_bytes():
            raise RuntimeError(f"Copied source differs from original: {source.name}")
        checksums.append(f"{sha256(copied)}  {source.name}")
    (ORIGINALS_DIR / "checksums.sha256").write_text("\n".join(checksums) + "\n", encoding="utf-8")

    combined = [
        "# Полные тексты выбранных отзывов и текущая разметка",
        "",
        "> Локальная исследовательская копия полных публичных отзывов и связанной разметки.",
        "",
    ]
    for review, record in paired:
        folder = "novel" if review["object_type"] == "novel" else "film"
        card = review_card(review, record, mentions_by_review[review["review_id"]])
        (FORMATTED_DIR / folder / f"{review['review_id']}.md").write_text(card, encoding="utf-8")
        combined.append(review_card(review, record, mentions_by_review[review["review_id"]], heading_level=2))
        combined.append("\n---\n")

    (FORMATTED_DIR / "all_selected_reviews.md").write_text("\n".join(combined), encoding="utf-8")
    write_index(paired, mentions_by_review)

    public_reviews = [
        {
            "review_id": review["review_id"],
            "original_text": record["body"],
            "raw_datetime": record["raw_datetime"] or review["review_date"],
            "raw_source_filename": LIVELIB_SOURCE.name
            if review["source"] == "livelib"
            else KINOPOISK_SOURCE.name,
            "raw_start_line": record["start_line"],
            "raw_end_line": record["end_line"],
        }
        for review, record in paired
    ]
    PUBLIC_REVIEW_TEXTS.write_text(
        json.dumps(public_reviews, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    readme = f"""# Локальный архив доказательств

Этот каталог создан для ручной проверки `evidence_short` и кодирования. Он исключён из Git и не обслуживается GitHub Pages.

## Содержимое

- `source_originals/` — побайтовые копии двух исходных `.txt` и SHA-256;
- `formatted/index.md` — индекс 24 выбранных отзывов;
- `formatted/all_selected_reviews.md` — все полные отзывы и разметка одним файлом;
- `formatted/novel/` и `formatted/film/` — отдельная карточка на каждый отзыв.

## Важно

Файл `{LIVELIB_SOURCE.name}` исторически назван «литрес», но его интерфейсные маркеры относятся к LiveLib. В карточках используется фактическая метка `LiveLib`.

Полные тексты являются сторонним пользовательским контентом. По решению проекта 24 выбранных оригинала дополнительно публикуются во вкладке «Отзывы» через `docs/data/review_texts.json`; сырые выгрузки и контрольные копии остаются в локальном архиве.

## Пересборка

```powershell
python tools\\build_local_evidence.py
```
"""
    (OUTPUT_ROOT / "README.md").write_text(readme, encoding="utf-8")

    novel_count = sum(review["object_type"] == "novel" for review, _ in paired)
    film_count = sum(review["object_type"] == "film" for review, _ in paired)
    print(
        f"Built local evidence archive: reviews={len(paired)} "
        f"novel={novel_count} film={film_count} mentions={len(mentions)}"
    )


if __name__ == "__main__":
    build()
