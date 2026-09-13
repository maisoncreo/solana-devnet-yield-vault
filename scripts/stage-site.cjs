const fs = require('fs');
fs.cpSync('frontend/dist', 'dist', {recursive: true});
