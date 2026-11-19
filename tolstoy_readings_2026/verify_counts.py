"""Пересчёт чисел доклада и статьи из review_matrix.csv. Запуск: python verify_counts.py"""
import csv
import os

rows = list(csv.DictReader(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "review_matrix.csv"), encoding="utf-8-sig")))
ids = {r["review_id"] for r in rows}
has = lambda code: {r["review_id"] for r in rows if r[code] == "1"}
M, F, E = has("Основание: материал"), has("Основание: чувство"), has("Отклик: чувство названо")
b13 = {"kinopoisk_013"}

print("рецензий в корпусе:", len(ids))
print("сравнение по материалу:", len(M))
print("сравнение по чувству:", len(F), "(без № 013:", len(F - b13), ")")
print("оба основания:", len(M & F), "(без № 013:", len((M & F) - b13), ")")
print("только материал:", len(M - F), "| только чувство:", len(F - M), "| ни то ни другое:", len(ids - M - F))
print("собственный отклик назван:", len(E))
