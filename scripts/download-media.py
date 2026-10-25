from concurrent.futures import ThreadPoolExecutor
import urllib.request
import subprocess
from pathlib import Path
out=Path('public/media')
images={'coast':'2387873','mountain':'1366919','forest':'35771810','ocean':'457882','desert':'10650274','japan':'402028','city':'355465','alpine':'547114','road':'466685','sea':'1295138','autumn':'1563356','window':'1571460','morning':'1287145','lake':'2662116','waves':'1533720'}
def get(item):
 name,id=item
 if (out/(name+'.jpg')).exists(): return name+' exists'
 try:
  subprocess.run(['curl','-fL','--retry','3','--retry-all-errors','--max-time','30','-sS','https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?w=1200','-o',str(out/(name+'.jpg'))],check=True)
  return name+' ok'
 except Exception as e:return name+' '+str(e)
with ThreadPoolExecutor(max_workers=2) as pool:
 for result in pool.map(get,images.items()):print(result)
subprocess.run(['curl','-fL','--retry','3','--retry-all-errors','--max-time','30','-sS','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4','-o',str(out/'flowers.mp4')],check=True)
print('video ok')

subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','2','-i',str(out/'flowers.mp4'),'-frames:v','1',str(out/'flower.jpg')],check=True)
