# Контекст для агента-разметчика

## Роль

Ты агент-специалист по разметке пользовательских отзывов для небольшого DH-проекта.

Твоя задача: подготовить проверяемые CSV-данные для дашборда "Anna Karenina Reception Map".

## Цель проекта

Проект выявляет, какие элементы "Анны Карениной" становятся заметными в пользовательской рецепции романа и экранизации Александра Зархи.

Не нужно определять, "понравился ли роман" или "хороший ли фильм". Нужно разметить рецептивные фокусы:

- какие персонажи обсуждаются;
- какие сюжетные узлы всплывают;
- какие моральные оценки повторяются;
- где читатель говорит о романе;
- где зритель говорит о фильме;
- где оценка фильма на самом деле относится к актёрской игре, кастингу, режиссуре или сравнению с книгой.

## Входные файлы

Локальные источники:

```text
C:\ag_work\pet_project\agent-writing-workbench\ITMO\files_for_project\литрес рецензии.txt
C:\ag_work\pet_project\agent-writing-workbench\ITMO\files_for_project\кинопоиск реаензии.txt
```

Проектная папка:

```text
C:\ag_work\pet_project\agent-writing-workbench\ITMO\anna-karenina-reception-map
```

Главные выходные файлы:

```text
docs\data\reviews.csv
docs\data\mentions.csv
docs\data\codebook.csv
```

## Что нужно сделать

1. Прочитать `README.md` и `methodology.md`.
2. Сделать рабочую разметку пилотной выборки.
3. Заполнить `reviews.csv`: одна строка на один отзыв.
4. Заполнить `mentions.csv`: одна строка на одно смысловое упоминание внутри отзыва.
5. При необходимости уточнить `codebook.csv`, но не раздувать его без необходимости.
6. Не публиковать полные тексты отзывов в публичных CSV. Использовать короткое доказательное резюме в `evidence_short`.

## Минимальный объём

Для первой версии достаточно:

- 10-15 отзывов на роман из LiveLib (исходный файл сохранён под именем `литрес рецензии.txt`);
- 10-15 отзывов на фильм из Кинопоиска;
- 40-80 упоминаний в `mentions.csv`.

Лучше меньше, но аккуратно и проверяемо.

## Правила разметки

### `reviews.csv`

Заполняй:

```text
review_id
source
object_type
author_name
review_date
rating
likes_count
review_title
analytical_value
review_mode
collection_method
url
```

`object_type`:

```text
novel
film
```

`analytical_value`:

```text
0 = нет конкретики
1 = общая оценка
2 = есть персонаж, мотив, конфликт или сцена
3 = есть интерпретация, сравнение, адаптационная претензия или сильная рецептивная рамка
```

`review_mode`:

```text
interpretive
emotional
comparative
technical_film
plot_retelling
canon_memory
```

### `mentions.csv`

Заполняй:

```text
mention_id
review_id
segment_topic
entity_type
entity_name
evaluation_target
reception_frame
comparison_mode
scene_origin
sentiment
evidence_short
confidence
coder_notes
```

`entity_type`:

```text
character
plot_node
motif
symbol
relationship
adaptation_element
film_craft
author
```

`evaluation_target`:

```text
book_plot
book_character
book_language
book_structure
author_position
adaptation_change
film_scene
acting
casting_appearance
visual_style
music_atmosphere
general_impression
```

`reception_frame`:

```text
moral_judgement
psychological_identification
gendered_reading
age_rereading
school_canon
levin_as_alternative_center
anna_as_tragic_symbol
family_marriage_conflict
adaptation_loss
acting_reception
```

`comparison_mode`:

```text
no_comparison
film_vs_book
film_vs_other_adaptation
actor_vs_character_image
```

`scene_origin`:

```text
book_based
film_added
film_modified
film_omitted
unknown
```

`sentiment`:

```text
positive
negative
mixed
neutral
```

`confidence`:

```text
1 = сомнительная разметка
2 = вероятная разметка
3 = уверенная разметка
```

## Принципы

- Не смешивай сюжет Толстого и актёрскую игру.
- Не смешивай персонажа романа и экранное воплощение.
- Если отзыв говорит "Вронский не похож", это чаще `casting_appearance` или `actor_vs_character_image`, а не оценка сюжета.
- Если отзыв говорит "линию Левина сократили", это `adaptation_change` и `adaptation_loss`.
- Если отзыв говорит "Анна эгоистична", это `book_character` или `film_scene` в зависимости от объекта отзыва, а рамка обычно `moral_judgement`.
- Если отзыв говорит "я в школе не понял, а сейчас понял", это `age_rereading` или `school_canon`.
- Если отзыв говорит "все помнят только поезд", это `anna_as_tragic_symbol`.

## Запрещённые выводы

Не писать:

- "читатели считают";
- "зрители доказали";
- "алгоритм выявил мнение аудитории";
- "фильм лучше/хуже книги".

Писать:

- "в пилотной выборке заметен фокус";
- "в отзывах часто возникает рамка";
- "данный отзыв кодируется как";
- "эта интерпретация требует ручной проверки".

## Ожидаемый результат первого прохода

После первого прохода должны быть готовы:

- заполненный `reviews.csv`;
- заполненный `mentions.csv`;
- при необходимости дополненный `codebook.csv`;
- короткая заметка в конце работы: какие рамки оказались полезны, какие метки не сработали, какие данные стоит добавить дальше.
