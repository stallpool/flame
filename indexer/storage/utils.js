const i_crypto = require('crypto');
const i_base64 = require('./base64');

function sha256(data) {
   let a = i_crypto.createHash('sha256');
   a.update(data);
   return a.digest('hex');
}

function md5(data) {
   let a = i_crypto.createHash('md5');
   a.update(data);
   return a.digest('hex');
}

function base64encode(data) {
   return i_base64.encode(data);
}

function base64decode(data) {
   return i_base64.decode(data);
}

module.exports = {
   md5,
   sha256,
   base64encode,
   base64decode,
};