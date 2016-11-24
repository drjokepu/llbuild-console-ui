const blessed = require('blessed');

let screen = blessed.screen({
    smartCSR: true
});

screen.title = 'LLBuild';

let root = blessed.box({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    style: {
        bg: 'black'
    }
});

screen.append(root);

let title = blessed.box({
    top: 0,
    left: 0,
    right: 9,
    height: 1,
    align: 'left',
    content: 'LLBuild'
});

root.append(title);

let timer = blessed.box({
    top: 0,
    right: 0,
    width: 8,
    height: 1,
    align: 'right',
    content: '00:00:00'
});

root.append(timer);

let pbar = blessed.progressbar({
    style: {
        bar: {
            fg: 'blue'
        }
    },
    ch: ':',
    height: 1,
    top: 1,
    left: 0,
    right: 5,
    filled: 100
});

root.append(pbar);

let pct = blessed.box({
    top: 1,
    right: 0,
    width: 4,
    height: 1,
    align: 'right',
    content: '1%'
});

root.append(pct);

let taskList = blessed.listtable({
    top: 2,
    left: 0,
    width: 50,
    bottom: 0,
    rows: [
        ['', 'task 1'],
        ['', 'task 2'],
        ['✓︎', 'task 3']
    ],
    style: {
        cell: {
            align: 'left'
        }
    }
});

root.append(taskList);

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return screen.destroy();
});

screen.render();