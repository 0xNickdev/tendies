# Tendies — визуалы для прогревочных постов

Восемь сюжетов под этапы прогрева. Все в одной стилистике, каждый решает свою
задачу в ленте — от «что-то намечается» до дня запуска.

**Как пользоваться:** копируешь блок сюжета, следом приклеиваешь два общих
блока из §0. Текст на картинку **не проси у модели** — стемпит скрипт (см. §9),
типографика будет фирменная и одинаковая во всех постах.

**Формат:** генерируй всё в **16:9** — это то, что X показывает в ленте без
обрезки. Скрипт отдаёт 1600×900.

---

## 0. Два общих блока — приклеивай к каждому сюжету

**СТИЛЬ:**

```
Flat vector illustration, bold closed silhouettes, two flat tones per object,
editorial poster style with confident geometry. Fill every tender with the
brand gradient. The background is solid near-black #071013 and completely
plain — no grid, no texture, no pattern, no vignette, no glow, no motion blur
lines. Keep every object fully inside the frame with a clear margin; nothing
may touch or be cut by any edge. No text, no letters, no numbers, no
watermark.
```

**ПАЛИТРА:**

```
Use only these colours: a gradient running at 215 degrees from light blue-grey
#ABC4CE at the top right, through steel blue #78A9BF, to deep slate #5C8394 at
the bottom left; solid near-black #071013; deep slate #102127 for shadows; and
mint #3CE3AB used sparingly as an accent. No lime, no yellow, no orange, no
brown, no golden fried tones, no warm colours anywhere in the image.
```

---

## 1. Тизер — «что-то намечается»

Первый пост, когда ещё никто ничего не знает. Пустота и одна деталь.

```
An empty wire fryer basket sitting alone in the lower right of a wide dark
frame, seen slightly from above, tilted a few degrees. A single breading crumb
rests on the floor of the basket. Nothing else in the picture — the entire
left two thirds is empty dark space. The mood is quiet and expectant, like a
kitchen before service.
```

## 2. Первый тендер — «оно живое»

```
A single chicken tender rising slowly out of deep darkness at the centre right
of a wide frame, lit along its upper edge, with three or four breading crumbs
drifting up beside it. The rest of the picture is empty dark space. The mood
is a reveal — one object, held.
```

## 3. Механика — «держишь и тебе платят»

Самый важный визуал всего прогрева: объясняет продукт без слов.

```
An open cardboard carton standing in the lower right of a wide frame with
three chicken tenders falling into it from above, caught mid-air at different
heights and angles, breading crumbs falling with them. The carton is drawn as
a simple flat silhouette. The left half of the picture is empty dark space.
```

## 4. Каждые 30 минут — про ритм

```
A large circular clock face without numbers in the right half of a wide frame,
its rim a thin light ring. In place of hands, two chicken tenders pivot from
the centre — a short one and a long one, set to roughly half past. A few
breading crumbs drift around the rim. The left half of the picture is empty
dark space.
```

## 5. Три акции — что именно получаешь

```
Three chicken tenders standing upright side by side in the right half of a
wide frame, evenly spaced, like bottles on a shelf — the middle one slightly
taller than the two beside it. Each casts a simple flat shadow beneath it. A
scatter of breading crumbs lies at their feet. The left half of the picture is
empty dark space.
```

## 6. Абсурд — для мемного поста

```
An absurdly tall mountain of chicken tenders piled up in the right half of a
wide frame, dozens of them stacked at every angle, the pile narrowing toward
the top and leaning slightly. A haze of breading crumbs surrounds the base.
The left half of the picture is empty dark space. The mood is deadpan excess.
```

## 7. Обратный отсчёт — под дату

Сюжет намеренно скупой: главное здесь цифра, которую положит скрипт.

```
One chicken tender standing perfectly upright, dead centre in the lower half
of a wide frame, small in the picture, with a single thin vertical line of
light rising from its top toward the upper edge but stopping short of it.
Everything else is empty dark space. The mood is minimal and patient.
```

## 8. День запуска — взрыв

```
A dozen chicken tenders bursting outward from a point just right of the centre
of a wide frame, radiating in every direction at different distances and
angles, with a wide spray of breading crumbs thrown out with them. A few
crumbs in mint. The burst does not reach the edges of the frame. The mood is
release — the moment it goes off.
```

---

## 9. Текст на постах — скрипт, а не модель

```bash
python3 banners/post.py <картинка> "Заголовок" "подстрочник" [файл.png]
```

Скрипт вырезает фон, ставит вордмарк и текст слева, арт справа и отдаёт
1600×900. Кегль подбирается под длину заголовка, а арт получает ровно то место,
которое осталось, — поэтому текст физически не может налезть на картинку. В
конце скрипт проверяет отбивку между ними и пишет `✓` или предупреждение.

Типографика и отступы одинаковые во всех постах, поэтому лента выглядит как
серия, а не как набор случайных картинок. Пример — `banners/post-example.png`.

Примеры для каждого этапа:

| Пост | Заголовок | Подстрочник |
| --- | --- | --- |
| 1 · тизер | `Something's frying.` | `SOON · SOLANA` |
| 3 · механика | `Hold the bag.\nGet the tendies.` | `TOKENIZED STOCKS, PAID TO HOLDERS` |
| 4 · ритм | `Every 30 minutes.` | `TSLA · NVDA · SPCX — YOUR PICK` |
| 5 · акции | `Paid in real stocks.` | `1:1 BACKED xSTOCKS ON SOLANA` |
| 6 · мем | `Nothing but tendies.` | `NO FARM TOKENS. NO POINTS. NO IOUs.` |
| 7 · отсчёт | `3 days.` | `LAUNCHING ON STONKFUN` |
| 8 · запуск | `Live.` | `STONKFUN.XYZ` |

Заголовок ломается на строки через `\n`.

## 10. Что проверять перед публикацией

- Уменьши до размера превью в ленте: если сюжет не читается — перегенерируй,
  а не спасай текстом.
- Фон должен быть плоским: если модель подсунула сетку или градиентную дымку,
  скрипт вырежет её вместе с сюжетом.
- Тёплые оттенки — брак. Еда тянет генератор в оранжевый, палитра это
  запрещает явно, но проверяй глазами.
