// Local harness for the compiled static output and Vercel response handler.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import handler, { publicPagePath } from '../api/public-page.js';
const root=resolve('dist');
const config=JSON.parse(await readFile('vercel.json','utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.svg':'image/svg+xml','.mp4':'video/mp4','.ttf':'font/ttf','.woff2':'font/woff2','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 res.status=code=>{res.statusCode=code;return res;};res.send=body=>res.end(body);res.json=data=>res.end(JSON.stringify(data));
 try {
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  const redirect=config.redirects.find(rule=>!rule.has && rule.source===path);
  if(redirect){res.writeHead(308,{Location:redirect.destination+url.search});return res.end();}
  if(path.endsWith('.html')){res.writeHead(308,{Location:path.slice(0,-5)+url.search});return res.end();}
  const page=publicPagePath(path==='/'?'index':path.slice(1));
  if(page){req.query={...Object.fromEntries(url.searchParams),page};return await handler(req,res);}
  const full=resolve(root,'.'+(extname(path)?path:path+'.html'));
  if(!full.startsWith(root+'/'))throw Error('Invalid path');
  const bytes=await readFile(full);res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch(error){res.status(404).send('Not found');}
}).listen(Number(process.env.PORT)||8772,'127.0.0.1',()=>console.log('Production preview at http://127.0.0.1:'+(process.env.PORT||8772)));
