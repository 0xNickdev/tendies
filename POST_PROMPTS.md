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

---

# Тексты постов

Восемь постов под восемь визуалов выше, плюс тред и посты на вовлечение.

**Тон:** сухо и уверенно, строчными, без «мы рады объявить», без частокола
эмодзи. В крипто-твиттере продаёт конкретика, а не восторг.

**Чего в текстах нет и быть не должно:** обещаний доходности, слова
«гарантированный», прогнозов APR. Механику описываем, результат — нет.

> ⚠️ Чистый тизер работает только если аудитория уже есть. У нового аккаунта
> с нуля подписчиков загадка не читается — её некому разгадывать. Поэтому
> посты 1–2 ставь коротким блоком за пару дней до запуска, а основную работу
> делают 3, 4 и 5: их репостят, потому что там сказано что-то полезное.

---

### 1 · Тизер → визуал «пустая корзина»

```
something's frying.

soon. on solana.
```

### 2 · Первое проявление → визуал «один тендер»

```
$TENDIE

hold the bag. get the tendies.
```

### 3 · Механика → визуал «тендеры падают в коробку»

Главный пост прогрева. Тредом, потому что тут есть что объяснить.

```
1/ you hold a token. every 30 minutes the treasury pays you in real
tokenized stock.

not points. not a farm token. not an IOU.

TSLAx, NVDAx or SPCXx — you pick.
```
```
2/ where it comes from: every trade pays a 2% fee. 1.5% of it lands in the
treasury, the launchpad keeps the rest.

no emissions, no inflation, nothing minted to pay you.

quiet week = small payouts. that's the honest version.
```
```
3/ what lands in your wallet is an xStock — a 1:1 collateralised equity
token on solana.

it's yours, in your own wallet. we can't touch it after it's sent.
```
```
4/ there's no claim button.

rewards accrue to your balance every 30 minutes and get sent automatically
once they clear about a dollar — under that they keep stacking, so network
fees never cost more than the payout.
```
```
5/ launching on @stonkfun, paired against TSLAx.

the pair is the thesis: a coin priced in tesla that pays you in stock.

$TENDIE — hold the bag, get the tendies.

gettendies.vercel.app
```

### 4 · Ритм → визуал «часы»

```
every 30 minutes the treasury splits whatever the fee collected across every
holder.

no staking. no locking. no claiming.

you just hold it.
```

### 5 · Акции → визуал «три тендера в ряд»

```
you choose what you get paid in:

TSLAx · NVDAx · SPCXx

1:1 backed xStocks on solana. sent to your wallet, not held in ours.
```

### 6 · Мем → визуал «гора тендеров»

```
diversified portfolio:

— tendies
— tendies
— tendies (nvidia flavoured)
```

### 7 · Отсчёт → визуал «один тендер по центру»

Три поста подряд, по одному в день. Текст в самой картинке, в твите — одна строка.

```
3.
```
```
2.
```
```
1. tomorrow.
```

### 8 · Запуск → визуал «взрыв»

```
live.

$TENDIE is on stonkfun.

hold it → the treasury pays you in real tokenized stocks every 30 minutes.

[ссылка на монету]
```

---

## Посты на вовлечение

Ставь между основными — они дешёвые и собирают ответы.

**Опрос** (у X есть встроенный, картинка не нужна):

```
you're getting paid every 30 minutes in real tokenized stock.

which ticker?

· TSLAx
· NVDAx
· SPCXx
```

**Вопрос:**

```
serious question: if a token paid you in actual TSLA instead of more of
itself, would you hold it longer?
```

**Скриншот терминала** — снимок Treasury с живым таймером до следующей выплаты:

```
the countdown is real. so are the candles.
```

---

## Дисциплина

- **Закреплённый пост** — тред из §3. Он объясняет продукт целиком и работает
  на любого, кто зашёл в профиль впервые.
- **В шапку профиля:** `hold the bag. get the tendies. · tokenized stock
  rewards every 30 min · solana`
- **Дисклеймер держи ответом под закреплённым тредом,** а не в каждом посте:
  xStocks официально недоступны в США, Великобритании, Канаде и Австралии, и
  ничего из этого не является инвестиционным советом.
- **Не обещай доходность.** Ни в постах, ни в ответах. Механика — можно,
  цифры будущей прибыли — нет: это то, за что потом разбирают.
