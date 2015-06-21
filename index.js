var Feedly = require('feedly');
var util = require('util');
var request = require('request');
var read = require('node-read');
var open = require('open');
var applescript = require('applescript');
var fs    = require('fs'),
     nconf = require('nconf');
var clipboard = require("copy-paste");
var exec = require('child_process').exec;
var mkdirp = require('mkdirp');

nconf.file('./config.json');
nconf.use('file', { file: './config.json' });

var f = new Feedly({
  client_id: nconf.get('client_id'),
  // 'REPLACE with your client_secret or use your developer-token and set developer=true (NOTE: developer mode only works on cloud.feedly.com not in sandbox)'
  client_secret: nconf.get('client_secret'),
  developer: nconf.get('developer'),
  port: 8080
});

var blessed = require('blessed')
, fs = require('fs');

var screen = blessed.screen({
  smartCSR: true,
  dockBorders: true
});

var listCategories = blessed.list({
  parent: screen,
  label: ' {bold}{cyan-fg}Categories',
  tags: true,
  draggable: true,
  top: 0,
  left: 0,
  width: '20%',
  height: '50%',
  keys: true,
  vi: true,
  mouse: true,
  border: 'line',
  scrollbar: {
    ch: ' ',
    track: {
      bg: 'cyan'
    },
    style: {
      inverse: true
    }
  },
  style: {
    item: {
      hover: {
        bg: 'blue'
      }
    },
    selected: {
      bg: 'blue',
      bold: true
    }
  }
});

var listEntries = blessed.list({
  parent: screen,
  label: ' {bold}{cyan-fg}Feed Entries',
  tags: true,
  draggable: true,
  top: 0,
  right: 0,
  width: '80%',
  height: '50%',
  keys: true,
  vi: true,
  mouse: true,
  border: 'line',
  scrollbar: {
    ch: ' ',
    track: {
      bg: 'cyan'
    },
    style: {
      inverse: true
    }
  },
  style: {
    item: {
      hover: {
        bg: 'blue'
      }
    },
    selected: {
      bg: 'blue',
      bold: true
    }
  }
});

function setlistEntrieslabel(string) {
  listEntries.setLabel({text:'{bold}{cyan-fg}Feed Entries (' + string +')',side:'center'});
}

function setContentLabel(string) {
  content.setLabel({text:'{bold}{cyan-fg}Feed Name: ' + string,side:'center'});
}

var categoriesMap = null;

f.categories().then(function(results) {
  categoriesMap = new Object();
  var userId = results[0].id.substring(0, results[0].id.lastIndexOf('/'));
  results.unshift({ id: userId.replace('category','tag') + '/global.saved', label: 'Saved'});
  results.unshift({ id: userId + '/global.all', label: 'All'});
  results.forEach(function(obj) {
    categoriesMap[obj.label] = obj;
    });
  listCategories.setItems(Object.keys(categoriesMap));
  screen.render();
},
function (error) {
	updateStatus(error);
});


var content = blessed.box({
  parent: screen,
  label: ' {bold}{cyan-fg}Feed Source:',
  tags: true,
  draggable: true,
  bottom: 1,
  right: 0,
  width: '100%',
  height: '50%',
  keys: true,
  vi: true,
  mouse: true,
  scrollable: true,
  border: 'line',
  scrollbar: {
    ch: ' ',
    track: {
      bg: 'cyan'
    },
    style: {
      inverse: true
    }
  },
  style: {
    item: {
      hover: {
        bg: 'blue'
      }
    }
  },
});

var status = blessed.box({
  parent: screen,
  bottom: 0,
  right: 0,
  height: 1,
  width: 'shrink',
  style: {
    bg: 'blue'
  },
  content: 'Feedly Terminal'
});

var loader = blessed.loading({
  parent: screen,
  top: 'center',
  left: 'center',
  height: 5,
  align: 'center',
  width: '50%',
  tags: true,
  hidden: true,
  border: 'line'
});

var msg = blessed.message({
  parent: screen,
  top: 'center',
  left: 'center',
  height: 'shrink',
  width: '50%',
  align: 'center',
  tags: true,
  hidden: true,
  border: 'line'
});

var prompt = blessed.prompt({
  parent: screen,
  top: 'center',
  left: 'center',
  height: 'shrink',
  width: 'shrink',
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  border: 'line',
  hidden: true
});

var entriesMap = null;

listCategories.on('select', function(el, selected) {
  if (listCategories._.rendering) return;
  if(el == null)
  {
    updateStatus('Error loading Categories');
    return;
  }

  var name = el.getText();
  var id = categoriesMap[name].id;
  status.setContent(id);

  listCategories._.rendering = true;
  loader.load('Loading...');

  f.contents(id, nconf.get('count'), nconf.get('ranked'), nconf.get('unreadOnly')).then(function(result) {
    loader.stop();
    listCategories._.rendering = false;

    entriesMap = new Object();
    result.items.forEach(function(obj) {
      entriesMap[obj.title] = obj;
      });

    listEntries.setItems(Object.keys(entriesMap));
    setlistEntrieslabel(Object.keys(entriesMap).length);
    listEntries.focus();
    screen.render();
  },
  function (error) {
    updateStatus(error);
    loader.stop();
    listCategories._.rendering = false;
    screen.render();
  });
});

listEntries.on('select', function(el, selected) {
  if (listEntries._.rendering) return;

  var name = el.getText();

  if(entriesMap[name] == null || entriesMap[name].alternate == null)
  {
        updateStatus(name + ' not found in entriesMap');
        return;
  }

  var url = entriesMap[name].alternate[0].href;

  listEntries._.rendering = true;
  loader.load('Loading...');

  read(url, function(err, article, res) {
    listEntries._.rendering = false;
    loader.stop();
    if(article == null) {
        updateStatus('Error fetching article');
        return;
    }

    var formattedContent = beautifyString(article.title + ' ' + article.content);
    try {
      content.setContent(formattedContent);
      content.focus();
      screen.render();
    }
    catch(ex) {
      content.setContent('');
      updateStatus(ex);
      screen.render();
    }
    finally {
    }
  });

});

function beautifyString(string)
{
  var removeHtml = string//.split("/<p[^>]*>/g").join("\n\n\n").split("</p>").join("")
    .replace(/<(?:.|\n)*?>/gm, '');

  for(i=300; i < removeHtml.length; i+=300)
  {
    var index = removeHtml.indexOf('.',i);
    if(index == -1)
        break;

    i = index + 1;
    removeHtml = [removeHtml.slice(0, i), '\n\n\n', removeHtml.slice(i)].join('');
  }
  
  return removeHtml;
}

listEntries.key('j', function(ch, key) {
  listEntriesScrollDown(ch, key);
});

listEntries.key('down', function(ch, key) {
  listEntriesScrollDown(ch, key);
});

listEntries.key('k', function(ch, key) {
  listEntriesScrollDown(ch, key);
});

listEntries.key('up', function(ch, key) {
  listEntriesScrollDown(ch, key);
});

function listEntriesScrollDown(ch, key) {
  if(listEntries.focused)
  {
    var index = listEntries.getScroll();
    switch (key.name) {
      case 'j':
      case 'down':
          if(index >= Object.keys(entriesMap).length - 1)
            return;
          if(nconf.get('markAsRead'))
            markAsRead(index);

          listEntriesScroll(index + 1);
        break;
      case 'k':
      case 'up':
          if(index == 0)
            return;
          listEntriesScroll(index - 1);
          break;
      default:
    }
  }
}

function markAsRead(index) {
  var item = listEntries.getItem(index);
  var name = item.getText();
  item = entriesMap[name];
  f.markEntryRead(item.id).then(function(results){
      updateStatus('success marked as read');
  },
  function (error) {
      updateStatus(error);
  });
}

function markAsSaved(index) {
  var item = listEntries.getItem(index);
  var name = item.getText();
  item = entriesMap[name];
  f.markEntrySaved(item.id).then(function(results){
      updateStatus('Article has been Saved');
  },
  function (error) {
      updateStatus(error);
  });
}

function markAsUnsaved(index) {
  var item = listEntries.getItem(index);
  var name = item.getText();
  item = entriesMap[name];
  f.markEntryUnsaved(item.id).then(function(results){
      updateStatus('Article has been unsaved');
  },
  function (error) {
      updateStatus(error);
  });
}

function listEntriesScroll(index) {
  var item = listEntries.getItem(index);
  var text = "";
  var count = Object.keys(entriesMap).length;
  if(item == null)
  {
    updateStatus(index + " not found. Length:" + count);
  }
  else
  {
    var name = item.getText();
    if(entriesMap[name] != null && entriesMap[name].summary != null) {
      text = entriesMap[name].summary.content;
      setContentLabel(entriesMap[name].origin.title);
    }
    else {
      updateStatus(name + " not found in entriesmap");
    }
  }
  setlistEntrieslabel(index + '/' + count);
  text = beautifyString(text);
  content.setContent(text);
  try {
    screen.render();
  } catch (e) {
    updateStatus(e);
  } finally {
  }
}

function updateStatus(content) {
  try {
    status.setContent(JSON.stringify(content));
  }catch(error) {
  }
  finally {
    screen.render();
  }
}

listCategories.items.forEach(function(item, i) {
  var text = item.label;
  item.setHover(categoriesMap[text]);
});

listEntries.items.forEach(function(item, i) {
  var text = item.id;
  item.setHover(entriesMap[text]);
});

listCategories.focus();

screen.key('i', function() {
  content.resetScroll();
  listCategories.focus();
});

screen.key('o', function() {
  content.resetScroll();
  listEntries.focus();
});

screen.key('p', function() {
  listCategories.focus();
});

screen.key('q', function() {
  return process.exit(0);
});

screen.key('s', function() {
  var index = listEntries.getScroll();
  markAsSaved(index);
});

screen.key('u', function() {
  var index = listEntries.getScroll();
  markAsUnsaved(index);
});

screen.key('v', function() {
  var index = listEntries.getScroll();
  var text = listEntries.getItem(index).getText();
  var entry = entriesMap[text];
  if(entry.alternate != null)
  {
    open(entry.alternate[0].href);
  }
});

screen.key('1', function() {
  var index = listEntries.getScroll();
  var text = listEntries.getItem(index).getText();
  var entry = entriesMap[text];
  if(entry.alternate != null)
  {
    clipboard.copy(entry.alternate[0].href);
    applescript.execString(nconf.get('applescript1').replace('$href$', entry.alternate[0].href), function(err, rtn) {
      if (err) {
        console.log(err);
      }
  });
  }
});

screen.key('2', function() {
  var index = listEntries.getScroll();
  var text = listEntries.getItem(index).getText();
  var entry = entriesMap[text];
  if(entry.alternate != null)
  {
    clipboard.copy(entry.alternate[0].href);
    applescript.execString(nconf.get('applescript2').replace('$href$', entry.alternate[0].href), function(err, rtn) {
      if (err) {
        console.log(err);
      }
  });
  }
});

screen.key('3', function() {
  var index = listEntries.getScroll();
  var text = listEntries.getItem(index).getText();
  var entry = entriesMap[text];
  if(entry.alternate != null)
  {
    clipboard.copy(entry.alternate[0].href);
    applescript.execString(nconf.get('applescript3').replace('$href$', entry.alternate[0].href), function(err, rtn) {
      if (err) {
        console.log(err);
      }
  });
  }
});

screen.key('m', function() {
  var index = listEntries.getScroll();
  var values = Object.keys(entriesMap);
  var result = [];
  var resultKeys = [];
  var count = 0;
  for(i = 0; i<= index; i++)
  {
    var entry = entriesMap[values[i]];
    if(entry.unread)
    {
      result.push(entry.id);
      resultKeys.push(values[i]);
      count++;
    }

    if(result.length >= 75 || i >= index)
    {
      f.markEntryRead(result).then(function(results){
        updateStatus('marked ' + count + '/' + index + ' items as read');
          resultKeys.forEach(function(obj) {
            entriesMap[obj].unread = false;
          });
      },
      function (error) {
          updateStatus(error);
      });
      result = [];
      resultKeys = [];
    }
  }
});

screen.key('b', function() {
  var count = 1;
  Object.keys(entriesMap).forEach(function (key) {
   updateStatus('Downloading ' + count + '/' + Object.keys(entriesMap).length + ' Entries');
   var entry = entriesMap[key];
    if(entry.alternate != null)
    {
      var shortId = entry.id.substr(entry.id.lastIndexOf('_'));
      var entryDir = __dirname + '/content/' + shortId;
      mkdirp(entryDir, function(err) { 
      // path was created unless there was error
    });
    /*
      if(!fs.existsSync(entryDir)) {
        console.log('mkdir ' + entryDir);
        exec('mkdir ' + entryDir, function (error, stdout, stderr) {
          console.log(error);
          console.log(stdout);
          console.log(stderr);
        });
        
      }
      */
      if(!fs.existsSync(entryDir + '/index.html')) {
        console.log('httrack ' + count);
        exec('httrack ' + entry.alternate[0].href + ' --depth=1 --ext-depth=1 -n --max-time=15 -O "' + entryDir + '"', function (error, stdout, stderr) {
          //    open(entryDir + '/index.html');
        });
      }
    }
    count++;
  });
  updateStatus('Finished Downloading ' + entriesMap.size + ' Entries');
});

screen.key('n', function() {
  var index = listEntries.getScroll();
  var text = listEntries.getItem(index).getText();
  var entry = entriesMap[text];
  if(entry.alternate != null)
  {
    var shortId = entry.id.substr(entry.id.lastIndexOf('_'));
    var entryDir = __dirname + '/content/' + shortId + '/index.html';
    if(fs.existsSync(entryDir)) {
          open(entryDir);
    }
  }
});

// https://github.com/chjj/blessed/issues/127
// https://github.com/Mithgol/node-singlebyte

function cp437ToUtf8(buf, callback) {
  try {
    return callback(null, singlebyte.bufToStr(buf, 'cp437'));
  } catch (e) {
    return callback(e);
  }
}
