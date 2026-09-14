# DEX / stonkfun banner, 1500x500, composed from brand assets - no AI art.
#   python3 banners/dex-banner.py   (run from the repo root)
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random, os
W,H=1500,500
INK=(7,16,19); SLATE=(16,33,39); LIGHT=(171,196,206); STEEL=(120,169,191); MINT=(60,227,171); DEEP=(92,131,148)
base=Image.open('banners/x-header-tendies.png').convert('RGBA')
img=Image.new('RGBA',(W,H),INK+(255,))
# faint grid
g=ImageDraw.Draw(img)
for x in range(0,W,50): g.line([(x,0),(x,H)],fill=SLATE+(120,),width=1)
for y in range(0,H,50): g.line([(0,y),(W,y)],fill=SLATE+(120,),width=1)
# the header art is opaque, so it goes first; the chart is drawn over it in
# the empty band left of the swarm, climbing to meet the swarm's tail
img.alpha_composite(base)
random.seed(11)
d=ImageDraw.Draw(img)
n=20; x0,x1=790,988; step=(x1-x0)/n
y_start,y_end=452,326            # climbs ~110px across the run
price=float(y_start)
for i in range(n):
    x=int(x0+i*step)
    target=y_start+(y_end-y_start)*(i/(n-1))
    up = random.random()<0.7
    body=random.uniform(10,30)
    o=price
    c=o-body if up else o+body
    # pull toward the trend line so the run reads as one climb
    c=c*0.6+target*0.4
    top=min(o,c); bot=max(o,c)
    wick_t=top-random.uniform(4,16); wick_b=bot+random.uniform(4,16)
    col=MINT if c<o else STEEL
    a=int(170+85*(i/n))
    d.line([(x,wick_t),(x,wick_b)],fill=col+(a,),width=1)
    d.rectangle([x-3,top,x+3,bot],fill=col+(a,))
    price=c
mark_y=int(price)
# dashed mark line from the copy zone to the last candle
for x in range(660,x1-70,18): d.line([(x,mark_y),(x+9,mark_y)],fill=LIGHT+(90,),width=1)
d.rounded_rectangle([x1-66,mark_y-11,x1+12,mark_y+11],radius=4,fill=MINT+(255,))
fm=ImageFont.truetype('/Library/Fonts/Inter_18pt-Bold.ttf',13)
d.text((x1-27,mark_y),"MARK",fill=INK,anchor="mm",font=fm)
# wordmark + copy, left zone
wm=Image.open('public/wordmark.webp').convert('RGBA'); wm=wm.resize((int(720*0.62),int(201*0.62)),Image.LANCZOS)
img.alpha_composite(wm,(70,118))
fh=ImageFont.truetype('/Library/Fonts/Inter_18pt-ExtraBold.ttf',46)
fs=ImageFont.truetype('/Library/Fonts/Inter_18pt-Medium.ttf',22)
d.text((72,262),"Hold $TENDIEPERP.",fill=(255,255,255),font=fh)
d.text((72,314),"Get paid in stocks.",fill=LIGHT,font=fh)
d.text((74,392),"OpenAI · TSLA · NVDA · SPCX  —  every 30 minutes  —  on Solana",fill=DEEP,font=fs)
# small chips row
chips=["0.5% of every trade → treasury","Perps up to 10×","tendiesonstonk.com"]
fc=ImageFont.truetype('/Library/Fonts/Inter_18pt-SemiBold.ttf',14)
x=74;y=440
for t in chips:
    w=d.textlength(t,font=fc)+26
    d.rounded_rectangle([x,y,x+w,y+28],radius=6,outline=DEEP+(200,),width=1,fill=SLATE+(180,))
    d.text((x+13,y+14),t,fill=LIGHT,font=fc,anchor="lm"); x+=w+10
out='banners/dex-banner-1500x500.png'
img.convert('RGB').save(out,optimize=True); print(out, img.size)
