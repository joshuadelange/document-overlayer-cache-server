'use strict' ;

$(document).ready(function(){

  var http = require('http'),
      https = require('https'),
      fs = require('fs'),
      userHomeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'],
      saveDir = userHomeDir + '/Documents/document-overlayer-cache/' ;

  console.log('checking if ', saveDir, 'exists...') ;
  fs.mkdir(saveDir, function(){
    console.log('created save dir', arguments) ;
    $('.saveLocation').html('Saving files in: ' + saveDir) ;
  }) ;

  http.createServer(function (req, res) {

    var urlParts = req.url.split('/') ;

    console.log(urlParts) ;

    if(urlParts[1].indexOf('http') > -1) {

      var url = decodeURIComponent(urlParts[1]) ;

      $('.log').prepend('<li>Waiting for Google\'s magic...</li>') ;

      $('iframe').remove() ; //double check
      var $iframe = $('<iframe />').attr('src', url) ;
      $('body').append($iframe) ;

      $('iframe').load(function(){
  
        console.log('iframe loaded') ;

        var baseImageURL = 'https://docs.google.com/viewer' + $('iframe').contents().find('.page-image:nth-of-type(2)').attr('src'),
            numberOfPages = parseInt($('iframe').contents().find('#controlbarPageNumber').html().split(' / ')[1], 10),
            documentName = decodeURIComponent(decodeURIComponent(baseImageURL).replace('https://docs.google.com/viewer?url=https://dl.dropboxusercontent.com/s/', '').split('/')[1].split('?')[0]),
            docSaveDir = saveDir + documentName.replace(' ', '-').replace('.', '-') ;

        console.log(numberOfPages) ;
        console.log(baseImageURL) ;
        console.log(documentName) ;
        console.log(docSaveDir) ;

        $('.log').prepend('<li>Downloading ' + numberOfPages + ' pages for ' + documentName + '</li>') ;

        fs.mkdir(docSaveDir, function(){

          console.log('doc folder is ready') ;

          var downloadNextPage = function(i){

            console.log('attemtping to save page ', i) ;

            var pageImageURL = baseImageURL.replace('pagenumber=1', 'pagenumber=' + i),
                pageSaveLocation = docSaveDir + '/page-' + i + '.png' ;
    
            fs.exists(pageSaveLocation, function(exists) {

              console.log('file exists:', exists) ;

              if(!exists) {

                console.log('starting file download request') ;

                https.get(pageImageURL, function(response) {

                  var imageData = '' ;

                  response.setEncoding('binary') ;

                  response.on('data', function(chunk) {
                    console.log('writing data') ;
                    imageData += chunk;
                  });

                  response.on('end', function () {

                    console.log('end of receiving') ;
            
                    fs.writeFile(pageSaveLocation, imageData, 'binary', function(err){

                      if(err) {
                        throw err;
                      }

                      console.log('File: ' + pageSaveLocation + ' written!');

                    }) ;

                    $('.log li:first').html('<li>Downloading ' + i + '/' + numberOfPages + ' pages for ' + documentName + '</li>') ;

                    if(i > 1) {
                      downloadNextPage(i - 1) ;
                    }

                    if(i === 0) {
                      $('.log').prepend('<li>Finished downloading ' + documentName + '</li>') ;
                      $('iframe').remove() ;
                    }

                  });

                });

              }
              else {
                console.log('file already exists') ;

                if(i > 1) {
                  downloadNextPage(i - 1) ;
                }

              }

            });

          } ;

          downloadNextPage(numberOfPages) ;

        }) ;

      }) ;

    }

    console.log(req, res) ;

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('success');

  }).listen(1337, '127.0.0.1');

  $('.status').html('Ready for caching') ;

}) ;