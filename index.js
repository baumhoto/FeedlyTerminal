var Feedly = require('feedly');
var util = require('util');
var q = require('q');
var request = require('request');

var f = new Feedly({
  client_id: 'sandbox',
  client_secret: 'A4143F56J75FGQY7TAJM',
  port: 8080
});



//console.log(map);
/*
f.stream('user/ba92d44e-3673-4644-bdd7-d188a6c9e31b/category/hacker').then(function(results) {
  console.log(results);
},
function (error) {
	console.log(error);
});

f.contents('user/ba92d44e-3673-4644-bdd7-d188a6c9e31b/category/global.all').then(function(results) {
  console.log('callback');
  //setTimeout(console.log(results), 3000);
  //console.log(JSON.stringify(results));
  //console.log('3ld' + results);
},
function (error) {
  console.log(error);
});


*/
/*
var promise = f.contents('user/ba92d44e-3673-4644-bdd7-d188a6c9e31b/category/global.all');

//var promise = f.subscriptions('user/ba92d44e-3673-4644-bdd7-d188a6c9e31b');

q.all(promise).then(function(result) {
  console.log(result);
})
*/

var blessed = require('blessed')
, fs = require('fs');

// $ wget -r -o log --tries=10 'http://artscene.textfiles.com/ansi/'
// $ grep 'http.*\.ans$' log | awk '{ print $3 }' > ansi-art.list
/*
var max = Object.keys(map).reduce(function(out, text) {
  return Math.max(out, text.length);
}, 0) + 6;
*/
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

var categoriesMap = null;

f.categories().then(function(results) {
  categoriesMap = new Object();
  results.forEach(function(obj) {
    categoriesMap[obj.label] = obj;
    });
  listCategories.setItems(Object.keys(categoriesMap));
},
function (error) {
	console.log(error);
});


var content = blessed.box({
  parent: screen,
  label: ' {bold}{cyan-fg}Feed Content',
  tags: true,
  draggable: true,
  bottom: 1,
  right: 0,
  width: '100%',
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

  var promise = f.contents(id);

  q.all(promise).then(function(result) {
    listCategories._.rendering = false;
    loader.stop();

    //console.log(result);
    entriesMap = new Object();
    result.items.forEach(function(obj) {
      //console.log(obj);
      entriesMap[obj.title] = obj;
      });
    listEntries.setItems(Object.keys(entriesMap));
    listEntries.focus();
  },
  function (error) {
    console.log(error);
  });
  screen.render();

    //console.log(result);

    /*
      return cp437ToUtf8(body, function(err, body) {
        if (err) {
          return msg.error(err.message);
        }

        screen.render();
  })
  });
  */
});

listEntries.on('select', function(el, selected) {
  if (listEntries._.rendering) return;

  var name = el.getText();
  var id = entriesMap[name].summary.content;
  content.setContent(id);
  //content.focus();
  screen.render();
  //status.setContent(id);

  //listEntries._.rendering = true;
  //loader.load('Loading...');
  //  listEntries._.rendering = false;
  //  loader.stop();
  //  screen.render();
});

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
          listEntriesScroll(index + 1);
        break;
      case 'k':
      case 'up':
          listEntriesScroll(index - 1);
          break;
      default:
    }
  }
}

function listEntriesScroll(index) {
  var name = listEntries.getItem(index).getText();
  var id = entriesMap[name].summary.content;
  content.setContent(id);
  screen.render();
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
//list.enterSelected(0);

screen.key('h', function() {
  listCategories.toggle();
  if (list.visible) list.focus();
});

screen.key('q', function() {
  return process.exit(0);
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

// Animating ANSI art doesn't work for screenshots.
var ANIMATING = [
  'bbs/void3',
  'holiday/xmasfwks',
  'unsorted/diver',
  'unsorted/mash-chp',
  'unsorted/ryans47',
  'unsorted/xmasfwks'
];
