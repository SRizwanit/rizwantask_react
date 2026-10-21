// GitHub Pages: ডিপ-লিংক (যেমন /রিপো/task) যেন ৪০৪ না দিয়ে অ্যাপ খোলে — index.html-কে 404.html হিসেবেও রাখা হয়।
import fs from 'node:fs';
fs.copyFileSync('dist/index.html', 'dist/404.html');
fs.writeFileSync('dist/.nojekyll', '');
console.log('postbuild: 404.html + .nojekyll তৈরি হয়েছে');
