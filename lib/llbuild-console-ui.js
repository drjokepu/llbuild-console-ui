const blessed = require('blessed');
const os = require('os');

class LLBuildConsoleUI {
    constructor(builder) {
        this.builder = builder;
        builder.options.quiet = true;

        this.screenElements = {};
        this.buildState = null;

        this.__didBuildStart = this.didBuildStart.bind(this);
        this.__didBuildComplete = this.didBuildComplete.bind(this);
        this.__didBuildFail = this.didBuildFail.bind(this);
        this.__didTargetExecutionStart = this.didTargetExecutionStart.bind(this);
        this.__didTargetExecutionComplete = this.didTargetExecutionComplete.bind(this);
        this.__didTargetExecutionFail = this.didTargetExecutionFail.bind(this);
        this.__didConsoleOutput = this.didConsoleOutput.bind(this);

        this.addBuilderEventListeners();
    }

    addBuilderEventListeners() {
        this.builder.addListener('buildStarted', this.__didBuildStart);
        this.builder.addListener('buildComplete', this.__didBuildComplete);
        this.builder.addListener('buildFailed', this.__didBuildFail);
        this.builder.addListener('targetExecutionStarted', this.__didTargetExecutionStart);
        this.builder.addListener('targetExecutionCompleted', this.__didTargetExecutionComplete);
        this.builder.addListener('targetExecutionFailed', this.__didTargetExecutionFail);
        this.builder.addListener('consoleOutput', this.__didConsoleOutput);
    }

    static makeEmptyBuildState() {
        return {
            rootTargetName: '',
            progress: 0,
            consoleOut: ''
        };
    }

    getTaskListFromBuilder(rootTargetName) {
        const target = this.builder.targets[rootTargetName];

        if (target === null || target === undefined || target === true || target === false) {
            return [];
        } else if (target.constructor === Array) {
            return LLBuildConsoleUI.consolidateTaskNames(target.map(t => this.getTaskListFromBuilder(t)));
        } else if (target.constructor === String) {
            return [target];
        } else if (target.constructor === Function) {
            return [rootTargetName];
        } else {
            throw new Error(`Unsupported target type: ${typeof(target)}`);
        }
    }

    static consolidateTaskNames(src) {
        let l = [];
        for (let i = 0; i < src.length; i++) {
            const a = src[i];
            for (let j = 0; j < a.length; j++) {
                const v = a[j];
                if (!l.some(lv => lv === v)) {
                    l.push(v);
                }
            }
        }

        return l;
    }

    didBuildStart(ev) {
        this.buildState = LLBuildConsoleUI.makeEmptyBuildState();
        this.buildState.rootTargetName = ev.targetName;
        this.buildState.allTasks = this.getTaskListFromBuilder(ev.targetName);
        this.buildState.activeTasks = [];
        this.buildState.resolvedTasks = [];
        this.setupScreen();
        this.updateElements();
    }

    didBuildComplete() {
        this.destroyScreen();
        console.log(this.buildState.consoleOut);
    }

    didBuildFail() {
        this.destroyScreen();
        console.log(this.buildState.consoleOut);
    }

    didTargetExecutionStart(ev) {
        if (!this.buildState.allTasks.some(t => t === ev.targetName)) {
            return;
        }

        this.buildState.activeTasks.push({ name: ev.targetName, started: new Date() });
        this.updateElements();
    }

    didTargetExecutionComplete(ev) {
        let task = this.buildState.activeTasks.find(t => t.name === ev.targetName);
        if (!task) {
            return;
        }

        this.buildState.activeTasks = this.buildState.activeTasks.filter(t => t.name !== ev.targetName);
        task.completed = new Date();
        task.successful = true;
        this.buildState.resolvedTasks.unshift(task);
        this.updateProgress();
        this.updateElements();
    }

    didTargetExecutionFail(ev) {
        let task = this.buildState.activeTasks.find(t => t.name === ev.targetName);
        if (!task) {
            return;
        }

        this.buildState.activeTasks = this.buildState.activeTasks.filter(t => t.name !== ev.targetName);
        task.completed = new Date();
        task.successful = false;
        this.buildState.resolvedTasks.unshift(task);
        this.updateProgress();
        this.updateElements();
    }

    updateProgress() {
        if (this.buildState.allTasks.length === 0) {
            this.buildState.progress = 0;
        } else {
            this.buildState.progress = this.buildState.resolvedTasks.length / this.buildState.allTasks.length;
        }
    }

    didConsoleOutput(ev) {
        if (this.screenElements && this.screenElements.tty) {
            this.screenElements.tty.insertBottom(ev.content);
            this.screenElements.tty.setScrollPerc(100);
            this.screenElements.tty.render();
        }

        if (this.buildState) {
            this.buildState.consoleOut += (ev.content + os.EOL);
        }
    }

    setupScreen() {
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
            align: 'left'
        });

        root.append(title);

        let timer = blessed.box({
            top: 0,
            right: 0,
            width: 8,
            height: 1,
            align: 'right'
        });

        root.append(timer);

        let pbar = blessed.progressbar({
            style: {
                bar: {
                    fg: 'blue'
                }
            },
            ch: ':',
            height: 3,
            top: 1,
            left: 0,
            right: 5,
            filled: 0,
            border: {
                type: 'line'
            }
        });

        root.append(pbar);

        let pct = blessed.box({
            top: 2,
            right: 0,
            width: 4,
            height: 1,
            align: 'right'
        });

        root.append(pct);

        let taskList = blessed.box({
            top: 4,
            left: 0,
            width: 50,
            bottom: 0,
            tags: true
        });

        root.append(taskList);

        let sep0 = blessed.line({
            top: 4,
            bottom: 0,
            left: 50,
            width: 1,
            orientation: 'vertical'
        });

        root.append(sep0);

        let tty = blessed.box({
            top: 4,
            left: 51, 
            right: 0,
            bottom: 0,
            tags: false,
            scrollable: true
        });

        root.append(tty);

        this.screenElements = {
            screen: screen,
            title: title,
            pbar: pbar,
            pct: pct,
            taskList: taskList,
            tty: tty
        };
    }

    destroyScreen() {
        if (this.screenElements && this.screenElements.screen) {
            this.screenElements.screen.destroy();
            this.screenElements = null;
        }
    }

    updateElements() {
        if (!this.screenElements || !this.buildState) {
            return;
        }

        this.screenElements.title.setText(this.getTitle());
        this.screenElements.pbar.setProgress(this.buildState.progress * 100);
        this.screenElements.pct.setText(Math.floor(this.buildState.progress * 100) + '%');
        this.screenElements.taskList.setContent(this.makeTaskListContent());

        this.screenElements.screen.render();
    }

    getTitle() {
        if (this.builder.name) {
            return `${this.builder.name}: ${this.buildState.rootTargetName}`;
        } else {
            return this.buildState.rootTargetName;
        }
    }

    makeTaskListContent() {
        let c = '';

        if (this.buildState.activeTasks.length > 0) {
            c += 'Now Building:' + os.EOL;
        }

        for (let i = 0; i < this.buildState.activeTasks.length; i++) {
            c += '{#ffff40-fg} > ' + blessed.escape(this.buildState.activeTasks[i].name) + '{/}' + os.EOL;
        }

        if (this.buildState.resolvedTasks.length > 0) {
            if (this.buildState.resolvedTasks.some(t => !t.successful)) {
                if (this.buildState.resolvedTasks.some(t => t.successful)) {
                    c += 'Failed:' + os.EOL;
                } else {
                    c += 'Completed or Failed:' + os.EOL;
                }
            } else {
                c += 'Completed:' + os.EOL;
            }
        }

        for (let i = 0; i < this.buildState.resolvedTasks.length; i++) {
            const t = this.buildState.resolvedTasks[i];
            if (t.successful) {
                c += '{#20ff20-fg} ✔︎ ' + blessed.escape(t.name) + ' (' + LLBuildConsoleUI.formatDuration(t) + ') {/}' + os.EOL;
            } else {
                c += '{#ff2020-fg} ✘ ' + blessed.escape(t.name) + ' (' + LLBuildConsoleUI.formatDuration(t) + ') {/}' + os.EOL;
            }
        }
        return c;
    }

    static formatDuration(task) {
        const d = task.completed.getTime() - task.started.getTime();
        const minutes = Math.floor(d / 60000);
        const seconds = Math.floor((d % 60000) / 1000);

        return `${LLBuildConsoleUI.padNumber2(minutes)}:${LLBuildConsoleUI.padNumber2(seconds)}`;
    }

    static padNumber2(value, digits) {
        if (value < 10) {
            return '0' + value;
        } else {
            return value;
        }
    }
}

module.exports = LLBuildConsoleUI;