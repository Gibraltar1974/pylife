const https = require('https');

https.get('https://raw.githubusercontent.com/boschresearch/pylife/master/README.md', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n').filter(line => line.toLowerCase().includes('logo') || line.toLowerCase().includes('img') || line.toLowerCase().includes('image'));
    console.log(lines.join('\n'));
  });
});
