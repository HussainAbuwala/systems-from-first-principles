"""Assemble the deck into one self-contained page: episode.src.html + beats.js + runs.json -> episode.html.

Usage: python3 build.py            (writes episode.html)
       python3 build.py --print    (also writes print.html, every slide in its final state, one per page)
"""
import pathlib, sys

here = pathlib.Path(__file__).parent
src = (here / 'episode.src.html').read_text()
beats = (here / 'beats.js').read_text().strip().rstrip(';')
runs = (here / 'runs.json').read_text().strip()
page = src.replace('__BEATS__', beats, 1).replace('__RUNS__', runs, 1)
(here / 'episode.html').write_text(page)
print('wrote episode.html')

if '--print' in sys.argv:
    printer = '''
<style>
@page { size: 1600px 900px; margin: 0; }
body.printing > *:not(#pages) { display: none !important; }
body.printing { margin: 0; background: #fff; }
#pages img { display: block; width: 1600px; height: 900px; break-after: page; }
</style>
<script>
(async function(){
  if (document.fonts) await document.fonts.ready;
  const pages = document.createElement('div'); pages.id = 'pages';
  const cv = document.createElement('canvas'); const k = 2; cv.width = W*k; cv.height = H*k;
  const c = cv.getContext('2d');
  STATIC = true;
  EP.forEach(b => {
    c.setTransform(k,0,0,k,0,0);
    let sim = null, t = 0;
    if (b.kind === 'replay') { t = b.at ?? b.to; sim = new Sim(b); sim.warm({...sample(b.run,t)}); }
    renderBeat(c, b, steps(b)-1, t, sim, null);
    const img = new Image(); img.src = cv.toDataURL('image/png'); pages.appendChild(img);
  });
  STATIC = false;
  document.body.appendChild(pages); document.body.classList.add('printing');
})();
</script>
'''
    i = page.rindex('</body>') if '</body>' in page else len(page)
    (here / 'print.html').write_text(page[:i] + printer + page[i:])
    print('wrote print.html')
