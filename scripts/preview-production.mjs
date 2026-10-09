import sitemapHandler from '../api/sitemap.js';
// Local harness for the compiled static output and Vercel response handler.
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import handler, { publicPagePath } from '../api/public-page.js';
const root=resolve('dist');
const config=JSON.parse(await readFile('vercel.json','utf8'));
const apiRoutes=new Set((await readdir(new URL('../api/',import.meta.url))).filter(name=>/^[a-z][a-z-]*\.js$/.test(name)).map(name=>name.slice(0,-3)));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.svg':'image/svg+xml','.mp4':'video/mp4','.vtt':'text/vtt','.ttf':'font/ttf','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{
 res.status=code=>{res.statusCode=code;return res;};res.send=body=>res.end(body);res.json=data=>res.end(JSON.stringify(data));
 try {
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(path.startsWith('/api/')){
   const route=path.slice(5);
   if(!apiRoutes.has(route))return jsonError(res,404,'API route not found.');
   req.query=Object.fromEntries(url.searchParams);
   try{const {default:apiHandler}=await import(`../api/${route}.js`);return await apiHandler(req,res);}
   catch(error){if(!res.headersSent)return jsonError(res,500,'Local API request failed.');return res.end();}
  }
  if(path==='/sitemap.xml')return await sitemapHandler(req,res);
  const redirect=config.redirects.find(rule=>!rule.has && rule.source===path);
  if(redirect){res.writeHead(308,{Location:redirect.destination+url.search});return res.end();}
  if(path.endsWith('.html')){res.writeHead(308,{Location:path.slice(0,-5)+url.search});return res.end();}
  const page=publicPagePath(path==='/'?'index':path.slice(1));
  if(page){req.query={...Object.fromEntries(url.searchParams),page};return await handler(req,res);}
  const candidates=extname(path)?[resolve(root,'.'+path)]:[
   resolve(root,'.'+path.replace(/\/$/,'')+'.html'),
   resolve(root,'.'+path,'index.html'),
  ];
  for(const full of candidates){
   if(!full.startsWith(root+'/'))throw Error('Invalid path');
   let bytes;
   try{bytes=await readFile(full);}catch(error){if(['ENOENT','ENOTDIR','EISDIR'].includes(error.code))continue;throw error;}
   res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});return res.end(bytes);
  }
  res.status(404).send('Not found');
 }catch(error){res.status(404).send('Not found');}
}).listen(Number(process.env.PORT)||8772,'127.0.0.1',()=>console.log('Production preview at http://127.0.0.1:'+(process.env.PORT||8772)));

function jsonError(res,status,error){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error}));}
