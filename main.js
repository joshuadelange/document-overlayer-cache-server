'use strict' ;

$(document).ready(function(){

  var http = require('http');

  http.createServer(function (req, res) {

    $('.log').prepend('<li>Receiving request for ' + req.url + '</h1>') ;

    console.log(req, res) ;

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello World\n');

  }).listen(1337, '127.0.0.1');

  $('.status').html('Cache server online') ;

}) ;