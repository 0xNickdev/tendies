# Tendies — промты для Flow (Nano Banana)

Промты ниже написаны под **Nano Banana** — она читает связное описание сцены,
а не список ключевых слов через запятую. Поэтому каждый блок — один абзац
живого текста, но с зашитыми числами: градусы, проценты кадра, пиксельные
безопасные зоны. Копируй блок целиком.

Две вещи, на которых держится весь пайплайн:

1. **Сначала знак, потом всё остальное.** Сгенерил логотип → сохранил →
   загружаешь его как референс в каждую следующую генерацию. Nano Banana
   отлично держит консистентность по картинке-референсу, и тендер везде будет
   одной и той же формы, а не тремя разными.
2. **Прозрачного фона не будет.** Модель всегда рисует подложку. Поэтому везде
   просим плоский `#071013` — он ровный, снимается волшебной палочкой в
   Preview/Figma за один клик, а на сайте видео/картинку можно вообще положить
   через `mix-blend-mode: screen`, и фон выпадет сам.

---

## 0. Палитра — вставляй в конец каждого промта

```
Use only these colours: a gradient running at 215 degrees from light blue-grey
#ABC4CE at the top right, through steel blue #78A9BF, to deep slate #5C8394 at
the bottom left; solid near-black #071013; deep slate #102127 for shadows; and
mint #3CE3AB used sparingly as an accent. No lime, no yellow, no orange, no
brown, no golden fried tones, no warm colours anywhere in the image.
```

---

## 1. Знак логотипа

```
Design a flat vector logo mark for a crypto project. The subject is a single
chicken tender — a breaded chicken strip — drawn as one closed silhouette that
bends upward along a smooth arc, so that the same shape reads at once as a
piece of food and as a rising market curve. Place it inside a rounded square
whose corner radius is a quarter of its width, and let that square fill the
entire square canvas edge to edge. The tender sits optically centred, rotated
38 degrees counter-clockwise, spanning 58 percent of the square's width, with
equal visual breathing room on all four sides. Three small circles run along
the tender's spine as breading, sized 7, 6 and 5.5 percent of the square and
spaced unevenly.

Fill the rounded square with the brand gradient. Make the tender solid
near-black #071013 with no outline. Make the three breading circles light
#ABC4CE. Keep every fill perfectly flat — no lighting, no shadows, no
highlights, no texture, no bevel, no gloss. The only tonal variation in the
entire image is the background gradient itself. The geometry should be simple
enough that a designer could redraw it with two bezier curves.

The register is a modern fintech app icon, not a cartoon, not a sticker, not a
mascot. Square 1:1 composition. No text, no letters, no numbers, no watermark.

[вставь блок палитры из §0]
```

**Проверка:** уменьши результат до 32 px и посмотри в круглом кропе. Если
форма превратилась в пятно — следующей репликой: `Simplify it further: one
bolder shape, thicker tender, remove the breading dots.`

**Варианты** — та же генерация, замени первое предложение:

- **Маскот:** `The subject is a chicken tender character with two small dot eyes and a flat deadpan mouth, wearing thin rectangular wireframe trader glasses; its body still bends along a rising-curve arc.`
- **Монограмма:** `The subject is a capital letter T built from two chicken tenders — one lying horizontally across the top, one standing vertically beneath it — with the negative space between them forming an upward arrow.`
- **Монета:** `The subject is a chicken tender centred inside a circular coin with twenty-four evenly spaced notches around its rim, like the milled edge of a real coin.`

---

## 2. Вордмарк — знак плюс название

Nano Banana хорошо рисует текст, поэтому локап имеет смысл делать в ней, а не
собирать вручную.

```
Create a horizontal logo lockup on a solid near-black #071013 background. On
the left sits the Tendies mark from the reference image, reproduced exactly as
given, at 100 pixels tall. To its right, separated by a gap equal to a third of
the mark's width, set the word "TENDIES" in a heavy geometric sans-serif —
uppercase, tight letter-spacing, cap height matching two thirds of the mark's
height. Render the word in light #ABC4CE, and place a single square period
after it in steel blue #78A9BF.

Align the mark and the word on a shared optical centre line. Leave clear space
around the whole lockup equal to the mark's height on every side. Everything is
perfectly flat — no shadows, no glow, no outline, no texture. The spelling must
be exactly TENDIES, nothing else.

[вставь блок палитры из §0]
```

> Загружай сюда знак из §1 как референс. Если модель переврала буквы — реплика
> `The word must read exactly T-E-N-D-I-E-S. Regenerate the text only, keep
> everything else identical.`

---

## 3. Аватар монеты для листинга stonkfun

В их листинге картинка режется в круг и показывается размером около 40 px.
Значит — только знак, никакой сцены.

```
Take the Tendies mark from the reference image and rebuild it as a standalone
coin avatar. Fill the entire square canvas with the brand gradient, edge to
edge, with no rounded-square frame, no border, no ring and no badge around it.
Place the tender solid near-black #071013, centred, rotated 38 degrees
counter-clockwise, spanning 54 percent of the canvas width, with three light
#ABC4CE breading dots along its spine.

The composition has to survive a circular crop that cuts off all four corners,
and it has to stay readable when the whole image is shrunk to 40 by 40 pixels —
so keep the shape large, bold and free of any small detail. Flat fills only.
Square 1:1. No text, no letters, no watermark.

[вставь блок палитры из §0]
```

---

## 4. Хиро-арт — три слоя под параллакс

Хиро на сайте разъезжается по глубине за курсором, поэтому нужны **три
отдельные генерации**, а не одна картинка. Меняется только предложение,
помеченное **Слой**.

```
Illustrate a fryer basket of chicken tenders caught in mid-air, tumbling and
fanning apart in slow motion. Each strip is a thick, chunky, rounded form bent
along an upward arc, and together their arcs trace a rising chart line. Loose
breading crumbs hang in the air between them, thinning out as they travel
outward.

Compose it on a 3:2 canvas and confine the entire mass of tenders to the right
third of the frame — the left two thirds stay completely empty, because a
headline will be typeset there, and nothing may cross the vertical centre line.
The cluster rises diagonally from the lower left of that right third toward its
upper right corner.

Слой: [подставь одно из трёх ниже]

Draw it as flat vector illustration in an editorial poster register — the key
visual of a sneaker drop, not a food advert. Bold closed silhouettes, at most
two flat tones per object, hard clean edges, no texture, no noise, no
photorealism, generous negative space. Fill every tender with the brand
gradient and use deep slate #102127 for the shaded undersides. Crumbs are light
#ABC4CE, with two or three in mint #3CE3AB. Imply a cool rim light from the
upper right purely through where the light end of the gradient falls on each
form — never add a separate highlight or glow.

Put it on a flat, seamless near-black #071013 background with nothing else in
the frame: no basket, no plate, no table, no hands, no steam, no oil, no
droplets, no scenery. No text, no letters, no watermark.

[вставь блок палитры из §0]
```

Три прогона:

1. `Слой: draw only the far background plane — three tenders, small in the frame, noticeably paler and lower in contrast than the others, as if seen through haze, and nothing else.`
2. `Слой: draw only the midground plane — three tenders at full size and full contrast, the hero shapes of the composition, and nothing else.`
3. `Слой: draw only the foreground plane — one oversized tender fragment cropped by the right edge of the frame, plus a scatter of large breading crumbs, and nothing else.`

Сохрани как `public/hero-back.png`, `hero-mid.png`, `hero-front.png`,
раскомментируй `HERO_LAYERS` в `components/landing/HeroArt.tsx` — каждый слой
получит свою глубину автоматически.

**Альтернатива без еды в лоб** — замени первый абзац:

```
Illustrate a candlestick chart climbing from the lower left to the upper right,
where every candle body is subtly shaped like a chicken tender — rounded ends,
slightly bowed sides — so the viewer registers the joke a second late. Thin
wicks rise above and drop below each body, and breading crumbs drift between
the candles. Eleven candles, irregular heights, the tallest at the far right.
```

---

## 5. Шапка X / Twitter

Flow выдаёт 16:9, шапке нужно 3:1 — поэтому **модель рисует сюжет, раскладку
режет код** (см. §8). И **текст ставит код, а не модель**: вордмарк с фирменной
типографикой у нас уже есть.

Из этого следуют два требования к любому промту ниже, и они важнее композиции:

1. **Фон плоский `#071013`, без сетки и текстуры** — иначе сюжет не отделить
   от фона.
2. **Ничего не обрезано краем кадра, всё важное в средней горизонтальной
   полосе.** При переходе 16:9 → 3:1 теряется 41% высоты, по 20% сверху и
   снизу. Объект, срезанный краем, после перестановки будет выглядеть
   обрубленным.

Каждый блок ниже — **целиком, копируй как есть**. Не собирай из кусков разных
сюжетов: во втором и третьем абзаце есть слова, привязанные к конкретной сцене.

### Свечи-тендеры — продуктовая шутка одной картинкой

```
A candlestick chart climbing from the lower left to the upper right, except
every candle body is a chunky chicken tender standing upright — rounded ends,
slightly bowed sides — with a thin wick above and below it. Eight candles,
irregular heights, each roughly following the one before it upward. The last
one on the right is by far the largest, tilted as if it has been launched,
with a spray of breading crumbs trailing behind it as exhaust. A few crumbs
drift between the other candles. Wicks in light #ABC4CE.

Wide 16:9 canvas. The chart occupies the right half of the picture; the whole
left half is empty dark space with nothing in it. The composition should feel
kinetic and a little absurd — the moment of a blow-off top — while still
reading instantly at thumbnail size.

Keep every object fully inside the frame with a clear margin — nothing may
touch or be cut by any edge. Everything important sits in the middle
horizontal band of the picture: the top fifth and the bottom fifth are empty
dark space.

Flat vector illustration, bold closed silhouettes, two flat tones per object,
editorial poster style with confident geometry. Fill each tender with the
brand gradient. The background is solid near-black #071013 and completely
plain — no grid, no texture, no pattern, no vignette, no glow, no motion blur
lines.

[вставь блок палитры из §0]
```

### Опрокинутая корзина — самый твиттерный, хаос и движение

```
A fryer basket tipped over on its side in the upper right of the frame, with
a dozen chicken tenders spilling out of it and tumbling down and to the left,
each at a different angle, some overlapping. A wide scatter of breading crumbs
flies with them. The tenders thin out toward the middle of the picture.

Wide 16:9 canvas. The spill occupies the right half; the whole left half is
empty dark space with nothing in it. The composition should feel kinetic and a
little absurd, while still reading instantly at thumbnail size.

Keep every object fully inside the frame with a clear margin — nothing may
touch or be cut by any edge. Everything important sits in the middle
horizontal band of the picture: the top fifth and the bottom fifth are empty
dark space.

Flat vector illustration, bold closed silhouettes, two flat tones per object,
editorial poster style with confident geometry. Fill each tender with the
brand gradient. The background is solid near-black #071013 and completely
plain — no grid, no texture, no pattern, no vignette, no glow, no motion blur
lines.

[вставь блок палитры из §0]
```

### Дождь из тендеров — буквально «тебе платят»

```
Chicken tenders falling like heavy rain, twelve of them at different sizes and
angles, densest at the right edge of the picture and thinning out toward the
middle. Breading crumbs fall with them. In the lower right, a single open
cardboard carton catches a few of them.

Wide 16:9 canvas. The rain occupies the right half; the whole left half is
empty dark space with nothing in it. The composition should feel kinetic and a
little absurd, while still reading instantly at thumbnail size.

Keep every object fully inside the frame with a clear margin — nothing may
touch or be cut by any edge. Everything important sits in the middle
horizontal band of the picture: the top fifth and the bottom fifth are empty
dark space.

Flat vector illustration, bold closed silhouettes, two flat tones per object,
editorial poster style with confident geometry. Fill each tender with the
brand gradient. The background is solid near-black #071013 and completely
plain — no grid, no texture, no pattern, no vignette, no glow, no motion blur
lines.

[вставь блок палитры из §0]
```

### Один тендер-ракета — минимализм

```
A single chicken tender flying diagonally upward across the right half of the
picture like a rocket, tilted about thirty degrees, with a long tapering trail
of breading crumbs behind it that thins out toward the lower left. Nothing
else in the picture.

Wide 16:9 canvas. The left half is empty dark space with nothing in it. The
composition should feel kinetic and a little absurd, while still reading
instantly at thumbnail size.

Keep every object fully inside the frame with a clear margin — nothing may
touch or be cut by any edge. Everything important sits in the middle
horizontal band of the picture: the top fifth and the bottom fifth are empty
dark space.

Flat vector illustration, bold closed silhouettes, two flat tones per object,
editorial poster style with confident geometry. Fill each tender with the
brand gradient. The background is solid near-black #071013 and completely
plain — no grid, no texture, no pattern, no vignette, no glow, no motion blur
lines.

[вставь блок палитры из §0]
```

## 5.1. Текст на баннере

На X твоё имя и @хендл и так стоят прямо под баннером, поэтому дублировать
название бессмысленно — **баннер должен говорить то, чего имя сказать не
может**. Значит на нём крючок, а не название:

- крупно: **Hold the bag. Get the tendies.**
- мелко: **TOKENIZED STOCKS, PAID OUT EVERY 30 MIN · SOLANA**
- вордмарк маленьким, сверху — он нужен на случай, когда баннер репостят
  скриншотом и контекста профиля рядом нет

Ставится кодом: `banners/x-header-tendies-text.png` собран так — вордмарк
берётся из `public/wordmark.webp` (фирменная типографика), текст ложится в
верхне-левую часть, потому что **аватар на X перекрывает низ слева**, а не
центр.

## 6. OG-картинка для ссылок

```
A wide landscape card split down the middle. The left half is completely
empty near-black space — a headline goes there later, so nothing may intrude.
The right half holds three chunky chicken tenders arranged along a diagonal
that rises to the right, the largest of them about two thirds as tall as the
card, with breading crumbs suspended between and above them.

Flat vector, bold silhouettes, two flat tones per object, premium fintech
poster — minimal, confident, uncluttered. Tenders filled with the brand
gradient, shaded undersides in deep slate #102127, crumbs in light #ABC4CE with
two or three in mint #3CE3AB. Background solid #071013, completely plain — no
grid, no texture. No text, no letters, no watermark.

[вставь блок палитры из §0]
```

---

## 7. Правки — точные реплики

Nano Banana сильна в диалоге: не перегенеривай с нуля, дожимай репликой.

| Что не так | Реплика |
| --- | --- |
| Композиция уехала | `Keep the subject, colours and style exactly as they are. Only change the composition: [новое описание композиции целиком].` |
| Слишком детально | `Simplify to one closed silhouette per object. Remove all inner detail, texture and highlights. Fewer, larger shapes.` |
| Цвет уплыл в тёплый | `Recolour strictly: [блок палитры]. There must be no warm hue anywhere in the image.` |
| Тендер стал другим | `Match the shape of the tender in the reference image exactly — same curve, same thickness, same proportions.` |
| Влез текст | `Remove all text and lettering from the image. The image must contain no characters of any kind.` |
| Нужен другой кроп | `Regenerate the same artwork as a [1500 by 500 / 1200 by 630 / square] composition, repositioning the subject to respect that frame.` |

---

## 8. Раскладку делает код, а не модель

Рабочий порядок для всего, где важен точный размер:

1. Модель рисует **сюжет** на плоском фоне `#071013`, в 16:9 — без сеток,
   рамок и безопасных зон.
2. Скрипт снимает фон, обрезает по сюжету, ставит в холст нужного размера и
   **проверяет зоны по факту**, считая непустые пиксели.

Тонкие линии (сетка, если она всё же появилась) снимаются морфологическим
открытием — `MinFilter` затирает всё уже ядра, `MaxFilter` возвращает объём
крупным формам. Крошки при ядре 7 выживают, линии в 3 px — нет.

Так сделан `banners/x-header-tendies.png`: сюжет из 16:9-генерации, холст
1500×500, левые 280 px и нижние 130 px проверены и пусты.

## 9. Экспорт и куда класть

| Ассет | Файл | Статус |
| --- | --- | --- |
| Знак | `public/logo-mark.webp` + `app/icon.png` | ✅ в проекте |
| Вордмарк-локап | `public/wordmark.webp` | ✅ в шапке, футере, доках, терминале |
| Хиро | `public/hero-tenders.webp` | ✅ в хиро, разложен на два плана параллакса |
| Аватар монеты | — | ⬜ загрузить в форму монеты на stonkfun |
| Шапка X | `banners/x-header-chart-text.png` | ✅ 1500×500, зоны проверены (без текста — `x-header-chart.png`) |
| OG-карточка | `public/og.png` | ⬜ скажи — пропишу в метаданные `app/layout.tsx` |

Все три готовых ассета прогнаны через альфа-кей (заливка фона от границы, так
что тёмный тендер внутри светлой плашки уцелел) и пережаты в WebP: логотип
5 КБ, локап 18 КБ, хиро 94 КБ вместо 730 КБ в PNG.

Фон снимается так: открыть в Preview → «Инструмент мгновенного альфа-канала» →
ткнуть в `#071013` → Delete → сохранить как PNG. Он идеально ровный, поэтому
края не поедут.

> Если решишь делать в Flow **видео** (Veo умеет 8-секундные лупы, 16:9 и 9:16,
> тоже без альфы) — в `HeroArt.tsx` уже лежит `HERO_VIDEO`: раскомментируй,
> положи `public/hero-loop.mp4`, и хиро подхватит клип, наложив его через
> `mix-blend-mode: screen` — чёрный фон выпадет сам. Проси у Veo плоский фон
> `#071013`, статичную камеру и одинаковые первый и последний кадры, иначе
> склейка лупа будет заметна.
