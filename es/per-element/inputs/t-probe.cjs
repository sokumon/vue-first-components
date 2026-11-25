// dump innerHTML snippets for a page
require('./lib.cjs')(process.argv[2], async ({ p }) => {
  for (const s of process.argv.slice(3)) console.log('---', s, '\n', await p.$eval(s, e => e.outerHTML.replace(/class="[^"]*"/g,'').slice(0, 1500)).catch(e => 'ERR ' + e.message.slice(0, 80)));
});
