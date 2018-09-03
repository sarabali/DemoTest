var xmlTextArea = document.getElementById('xmltextarea');
var xmlPathArea = document.getElementById('xpath');
var xmlDisplayArea = document.getElementById('xml_display');
var xmlContent = document.getElementById('line-data');
var xmlData;
var uniq;

function simpleId() {
  var s = 'abcdefghijklmnopqrstuvwxyz';
  var b = +(Math.random().toString().slice(2));
  var t = ((new Date()).valueOf() + b).toString();
  var u = '';
  s = s + s.toUpperCase();
  for (var i = 0, l, n; i < (t.length / 2); i++) {
    l = i * 2;
    n = +(t.slice(l, l + 2));
    u += s.charAt(n % s.length);
  }

  return u;
}

function searchXpath(xpath) {
  var doc = Defiant.xmlFromString(xmlTextArea.value);
  var xres = Defiant.node.selectNodes(doc, xpath);
  var i = 0;
  var il = xres.length;
  var ll;

  uniq = simpleId();

  for (; i < il; i++) {
    if (xres[i].ownerDocument.documentElement === xres[i]) continue;
    switch (xres[i].nodeType) {
      case 1: // type: node
        ll = Defiant.node.prettyPrint(xres[i]).match(/\n/g);
        ll = (ll === null) ? 0 : ll.length;
        xres[i].setAttribute(uniq, ll);
        break;
      case 2: // type: attribute
        xres[i].ownerElement.setAttribute(uniq, xres[i].name);
        break;
      case 3: // type: text
        xres[i].parentNode.setAttribute(uniq, '#text');
        break;
    }
  }

  renderXml(doc);
}

function renderXml(obj) {
  var doc = (obj.constructor === Object) ? JSON.toXML(obj) : obj;
  var str = Defiant.node.prettyPrint(doc)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  var lines = str.split('\n');
  var gutter = '';
  var ld = '';
  var i = 0;
  var il = lines.length;
  var hl = {
    index: 0,
    rgx: new RegExp('( ' + uniq + ')="(.*?)"'),
    attr: false,
    check: false,
  };
  var ls;
  var mlc;
  var htm;
  for (; i < il; i++) {
    mlc = '';
    ls = lines[i].replace(/\t/g, '   ');

    // xml declaration
    ls = ls.replace(/(&lt;\?.*?\?&gt;)/i, '<span class="dc">$1</span>');
    if (i > 0) {
      // collect info; matching lines
      hl.check = ls.match(hl.rgx);
      if (hl.check !== null) {
        hl.line = +hl.check[2];
        hl.attr = isNaN(hl.line);
        hl.isText = hl.check[2] === '#text';
        hl.index = i + hl.line + 1;
        ls = ls.replace(hl.rgx, '');
      }

      // attributes
      ls = ls.replace(/([\w-\:]+)="(.*?)"/g,
        '<span class="na">$1</span>="<span class="s">$2</span>"');

      // nodes
      ls = ls.replace(
        /(\&lt;[\w\d:]+\&gt;|\&lt;\/[\w\d:]+\&gt;|\&lt;[\w\d:]+\/\&gt;)/g,
        '<span class="nt">$1</span>');
      ls = ls.replace(/(\&lt;\w+ )(.*?)(\&gt;)/g,
        '<span class="nt">$1</span>$2<span class="nt">$3</span>');
      ls = ls.replace(/(\&lt;|\&gt;)/g, '<span class="p">$1</span>');

      // highlight matching lines
      if (hl.isText) {
        ls = ls.replace(/(<\/span><\/span>)(.*?)(<span class="nt"><span)/,
          '$1<span class="mal">$2</span>$3');
        hl.isText = false;
      } else if (hl.check !== null && hl.attr) {
        hl.rx2 = new RegExp('(<span class="na">' + hl.check[2] +
          '<.span>="<span .*?<.span>")', 'i');
        ls = ls.replace(hl.rx2, '<span class="mal">$1</span>');
      } else if (hl.check !== null || i < hl.index) {
        mlc = 'ml';
        ls = '<span class="ml">' + ls + '</span>';
      }

      // Wrap plain text with spans if it is not highlighted
      ls = ls.replace(/(<\/span><\/span>)(.*?)(<span class="nt"><span)/,
        '$1<span>$2</span>$3');
    }

    if (i > 0 && this.xpath === '//*') {
      mlc = 'ml';
      if (ls.indexOf(' class="ml"') === -1) {
        ls = '<span class="ml">' + ls + '</span>';
      }
    }

    // prepare html
    ld += '<div class="line ' + mlc + '">' + ls + '</div>';
    gutter += '<span>' + (i + 1) + '</span>';
  }

  htm = '<table><tr>' +
    '<td class="gutter">' + gutter + '</td>' +
    '<td id="line-data" class="line-data"><pre>' + ld + '</pre></td>' +
    '</tr></table>';
  xmlDisplayArea.innerHTML = htm;

  // making xml global - see notes in the begining of this file
  xmlData = doc;
}

function getXpath(xmlText, tagData) {
  var parser = sax.parser(true);
  var path = [];
  var testingcount = {};

  parser.onclosetag = function(tag) {
    if (parser.position > tagData.nodeEnd) {
      return;
    }

    if (tag == path[path.length - 1]) {
      // console.log('OnClose else!');
      path.pop();
      console.log(path);
      testingcount[tag.name] = testingcount[tag.name] - 1;
      // console.log('Testingcount closing !');
      console.log(testingcount);
    }

  };

  parser.onopentag = function(tag) {
    if (parser.position > tagData.nodeEnd + 1) {
      return;
    }
    // console.log('OnOpen else !');
    path.push(tag.name);
    console.log(path);
    if (tag.name in testingcount) {
      testingcount[tag.name] = testingcount[tag.name] + 1;
    } else {
      testingcount[tag.name] = 0;
    }
    // console.log('Testingcount opening !');
    console.log(testingcount);
  };

  parser.write(xmlText).end();
  path = path.map(function(e) {
    return e + '[' + testingcount[e] + ']'
  });
  return path;
}

function getTextAtCursor(completeText, selStart) {
  var textLen = completeText.length;
  var nodeStart = nodeEnd = selStart;
  var isNode = true;
  var ret = {};

  --nodeStart;

  while (nodeStart >= 0) {
    if (completeText[nodeStart] == '<') {
      ++nodeStart;
      break;
    } else if (completeText[nodeStart] == '>') {
      ++nodeStart;
      isNode = false;
      break;
    }

    --nodeStart;
  }

  if (nodeStart < 0) {
    ++nodeStart;
  }

  while (nodeEnd < textLen) {
    if (completeText[nodeEnd] == '<' || completeText[nodeEnd] == '>') {
      break;
    }

    ++nodeEnd;
  }

  if (isNode && completeText[nodeStart] == '/') {
    ++nodeStart;
  }

  if (!isNode) {
    // We are given text, so we can return the nodeBeginning before
    ret = getTextAtCursor(completeText, nodeStart - 2);
    ret.isNode = isNode;
  } else {
    ret.nodeStart = nodeStart;
    ret.nodeEnd = nodeEnd;
    ret.isNode = isNode;
  }
  // console.log("Text at cursor !");
  console.log(ret);
  return ret;
}

xmlTextArea.addEventListener('click', function() {
  if (this.value.length == 0) {
    return;
  }

  var selectedNodeData = getTextAtCursor(this.value, this.selectionStart);
  var path = getXpath(this.value, selectedNodeData);

  if (path.length == 0) {
    xmlPathArea.innerText = 'Invalid Location';
    return;
  }

  path = '/' + path.join('/');

  if (!selectedNodeData.isNode) {
    path += '/text()';
  }

  xmlPathArea.innerText = path;
  searchXpath(path);
});

xmlDisplayArea.onclick = function(event) {
  var el = event.target;
  var isText = false;

  // Clicked element can be span or div
  if (el.nodeName == 'SPAN') {
    if (el.className.indexOf('p') != -1) {
      // This is a tag
      el = el.parentNode;
    } else if (el.className == '' || el.className.indexOf('mal') != -1) {
      isText = true;
    }

    // Go parent till parent node is div
    while (el.nodeName != 'DIV') {
      el = el.parentNode;
    }
  }

  // If div, we need it to have class name line
  if (el.nodeName == 'DIV' && el.className.indexOf('line') != -1) {
    xmlContent = document.getElementById('line-data');
    var xmlText = xmlContent.textContent;
    var nodeData = {};
    nodeData.nodeStart = xmlText.indexOf(el.textContent);
    nodeData.nodeEnd = nodeData.nodeStart + el.textContent.length - 1;
    nodeData.isNode = !isText;

    var path = getXpath(xmlText, nodeData);

    if (path.length == 0) {
      xmlPathArea.innerText = 'Invalid Location';
      return;
    }

    path = '/' + path.join('/');

    if (!nodeData.isNode) {
      path += '/text()';
    }

    xmlPathArea.innerText = path;
    searchXpath(path);
  }
};
