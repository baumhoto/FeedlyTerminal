var Feedly = require('feedly');
var util = require('util');
var q = require('q');
var request = require('request');
var read = require('node-read');

var f = new Feedly({
  client_id: 'sandbox',
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
  },
  search: function(callback) {
    prompt.input('Search:', '', function(err, value) {
      if (err) return;
      return callback(null, value);
    });
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
  },
  search: function(callback) {
    prompt.input('Search:', '', function(err, value) {
      if (err) return;
      return callback(null, value);
    });
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
  results.unshift({ id: userId + '/global.saved', label: 'Saved'});
  results.unshift({ id: userId + '/global.all', label: 'All'});
  results.forEach(function(obj) {
    categoriesMap[obj.label] = obj;
    });
  listCategories.setItems(Object.keys(categoriesMap));
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
  content: 'Select your piece of ANSI art (`/` to search).'
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

  var name = el.getText();
  var id = categoriesMap[name].id;
  status.setContent(id);

  listCategories._.rendering = true;
  loader.load('Loading...');

  var promise = f.contents(id, 500, 'oldest', true);

  q.all(promise).then(function(result) {
    listCategories._.rendering = false;
    loader.stop();

    entriesMap = new Object();
    result.items.forEach(function(obj) {
      entriesMap[obj.title] = obj;
      });

    listEntries.setItems(Object.keys(entriesMap));
    setlistEntrieslabel(Object.keys(entriesMap).length);
    listEntries.focus();
  },
  function (error) {
    updateStatus(error);
  });
  screen.render();
});

listEntries.on('select', function(el, selected) {
  if (listEntries._.rendering) return;

  var name = el.getText();
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
    }
    finally {
      screen.render();
    }
  });

});

function beautifyString(string)
{
  return string.split("/<p[^>]*>/g").join("\n\n\n").split("</p>").join("")
    .replace(/<(?:.|\n)*?>/gm, '');
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
          //markAsRead(index);
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
      updateStatus('success marked as saved');
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
    if(entriesMap[name].summary != null) {
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

screen.key('m', function() {
  var index = listEntries.getScroll();
  var values = Object.keys(entriesMap);
  var result = [];
  for(i = 0; i<= index; i++)
  {
    result.push(entriesMap[values[i]].id);
  }
  f.markEntryRead(result).then(function(results){
      updateStatus('marked ' + i + ' items as read');
  },
  function (error) {
      updateStatus(error);
  });
});


screen.render();


// https://github.com/chjj/blessed/issues/127
// https://github.com/Mithgol/node-singlebyte

function cp437ToUtf8(buf, callback) {
  try {
    return callback(null, singlebyte.bufToStr(buf, 'cp437'));
  } catch (e) {
    return callback(e);
  }
}
