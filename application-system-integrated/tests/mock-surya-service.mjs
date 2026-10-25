import http from 'node:http';
// Tests the private sidecar response contract without requiring the model weights.
http.createServer((request,response)=>{
  let chunks='';
  request.on('data',part=>chunks+=part);
  request.on('end',()=>{
    const pages=JSON.parse(chunks).images.map(()=>({text:'නම: අමල් පෙරේරා\nගමන් බලපත්‍ර අංකය: N1234567',confidence:94}));
    response.writeHead(200,{'Content-Type':'application/json'});
    response.end(JSON.stringify({engine:'mock surya',pages}));
  });
}).listen(8501,'127.0.0.1',()=>console.log('Mock private Surya adapter listening on 8501'));
