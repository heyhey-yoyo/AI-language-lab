  (() => {
    "use strict";
    const START = "始";
    const END = "止";
    const presets = {
      hello: "你好呀\n你好世界\n你今天好吗\n今天阳光很好\n今天一起散步吧\n世界你好",
      poem: "月亮落进河里\n晚风吹过竹林\n星星住在水里\n小船穿过月光\n风把云朵吹远",
      cafe: "一杯热咖啡\n请给我一杯拿铁\n咖啡有一点香\n今天喝热拿铁\n谢谢你的咖啡"
    };
    const $ = id => document.getElementById(id);
    const ui = {
      input: $("corpusInput"), tabs: $("presetTabs"), tokens: $("tokenStrip"), matrix: $("matrix"),
      bars: $("probabilityBars"), focus: $("focusToken"), steps: $("stepCount"), loss: $("lossValue"),
      progress: $("progressValue"), chartLoss: $("chartLoss"), area: $("lossArea"), curve: $("lossCurve"),
      toggle: $("trainToggle"), spoken: $("spokenText"), temperature: $("temperature"),
      temperatureLabel: $("temperatureLabel")
    };
    let model;
    let selected = START;
    let activePreset = "hello";
    let history = [];
    let initialLoss = 0;
    let timer = null;
    let temperature = 0.7;
    let utteranceSeed = 1;

    function randomGenerator(seed) {
      let value = seed >>> 0;
      return () => {
        value += 0x6d2b79f5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function cleanLines(text) {
      return text.split(/\n+/).map(line => Array.from(line.replace(/\s+/g, "").trim())).filter(line => line.length);
    }

    function makeModel(text) {
      const lines = cleanLines(text);
      const chars = Array.from(new Set(lines.flat()));
      const vocab = [START, END, ...chars];
      const index = new Map(vocab.map((token, i) => [token, i]));
      const random = randomGenerator(20260813 + chars.length * 31);
      const weights = vocab.map(() => vocab.map(() => (random() - 0.5) * 0.16));
      const pairs = [];
      lines.forEach(line => {
        const sequence = [START, ...line, END];
        for (let i = 0; i < sequence.length - 1; i++) pairs.push([index.get(sequence[i]), index.get(sequence[i + 1])]);
      });
      return { text, vocab, index, weights, pairs, cursor: 0 };
    }

    function softmax(values, temp = 1) {
      const safe = Math.max(0.1, temp);
      const scaled = values.map(value => value / safe);
      const max = Math.max(...scaled);
      const exps = scaled.map(value => Math.exp(value - max));
      const sum = exps.reduce((total, value) => total + value, 0);
      return exps.map(value => value / sum);
    }

    function trainOne() {
      if (!model.pairs.length) return 0;
      const [current, target] = model.pairs[model.cursor % model.pairs.length];
      const probabilities = softmax(model.weights[current]);
      const loss = -Math.log(Math.max(probabilities[target], 1e-9));
      probabilities.forEach((probability, next) => {
        const gradient = probability - (next === target ? 1 : 0);
        model.weights[current][next] -= 0.72 * gradient;
      });
      model.cursor++;
      return loss;
    }

    function meanLoss() {
      if (!model.pairs.length) return 0;
      const total = model.pairs.reduce((sum, pair) => {
        const probability = softmax(model.weights[pair[0]])[pair[1]];
        return sum - Math.log(Math.max(probability, 1e-9));
      }, 0);
      return total / model.pairs.length;
    }

    function generate(seed) {
      const random = randomGenerator(73 + seed * 17);
      let current = model.index.get(START) || 0;
      const result = [];
      for (let position = 0; position < 18; position++) {
        const probabilities = softmax(model.weights[current], temperature);
        let cursor = random();
        let next = probabilities.length - 1;
        for (let candidate = 0; candidate < probabilities.length; candidate++) {
          cursor -= probabilities[candidate];
          if (cursor <= 0) { next = candidate; break; }
        }
        const token = model.vocab[next];
        if (token === END) break;
        if (token !== START) result.push(token);
        current = next;
      }
      return result.length ? result.join("") : "……";
    }

    function frequencyTokens() {
      const frequency = new Map();
      cleanLines(model.text).flat().forEach(token => frequency.set(token, (frequency.get(token) || 0) + 1));
      return [START, ...Array.from(frequency).sort((a, b) => b[1] - a[1]).map(item => item[0]).slice(0, 6)];
    }

    function renderTokens(text) {
      ui.tokens.replaceChildren();
      Array.from(new Set(cleanLines(text).flat())).slice(0, 18).forEach(token => {
        const span = document.createElement("span");
        span.textContent = token;
        ui.tokens.append(span);
      });
    }

    function renderMatrix() {
      const tokens = frequencyTokens();
      ui.matrix.style.gridTemplateColumns = `34px repeat(${tokens.length}, minmax(21px,1fr))`;
      ui.matrix.replaceChildren();
      ui.matrix.append(document.createElement("span"));
      tokens.forEach(token => {
        const label = document.createElement("span"); label.className = "label"; label.textContent = token; ui.matrix.append(label);
      });
      tokens.forEach(rowToken => {
        const rowIndex = model.index.get(rowToken) || 0;
        const probabilities = softmax(model.weights[rowIndex]);
        const row = document.createElement("button");
        row.className = "label" + (selected === rowToken ? " selected" : "");
        row.textContent = rowToken; row.dataset.row = rowToken; row.title = `查看“${rowToken}”之后的预测`;
        ui.matrix.append(row);
        tokens.forEach(columnToken => {
          const columnIndex = model.index.get(columnToken) || 0;
          const value = probabilities[columnIndex] || 0;
          const cell = document.createElement("button");
          cell.className = "cell"; cell.dataset.row = rowToken;
          cell.style.backgroundColor = `rgba(223,101,76,${Math.min(.88,.06 + value * 4.1)})`;
          cell.title = `${rowToken} → ${columnToken}: ${(value * 100).toFixed(1)}%`;
          ui.matrix.append(cell);
        });
      });
    }

    function renderBars() {
      const row = model.index.get(selected) || 0;
      const ranked = softmax(model.weights[row], temperature).map((probability, index) => ({ token:model.vocab[index], probability }))
        .filter(item => item.token !== START).sort((a,b) => b.probability - a.probability).slice(0,5);
      ui.focus.textContent = selected;
      ui.bars.replaceChildren();
      ranked.forEach((item, index) => {
        const bar = document.createElement("div"); bar.className = "bar";
        const token = document.createElement("b"); token.textContent = item.token === END ? "⌁" : item.token;
        const track = document.createElement("div"); const fill = document.createElement("i"); fill.style.width = `${Math.max(3,item.probability * 100)}%`; track.append(fill);
        const value = document.createElement("span"); value.className = "mono"; value.textContent = `${(item.probability * 100).toFixed(index ? 1 : 0)}%`;
        bar.append(token, track, value); ui.bars.append(bar);
      });
    }

    function drawChart() {
      const data = history.length > 1 ? history : [history[0] || 4, history[0] || 4];
      const max = Math.max(...data, .1), min = Math.min(...data, max - .01), range = Math.max(max - min, .2);
      const points = data.map((value, index) => {
        const x = index / Math.max(data.length - 1, 1) * 560;
        const y = 10 + (max - value) / range * 124;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      ui.curve.setAttribute("points", points);
      ui.area.setAttribute("points", `0,148 ${points} 560,148`);
    }

    function renderAll(refreshSpeech = true) {
      const loss = meanLoss();
      ui.steps.textContent = model.cursor.toLocaleString("zh-CN");
      ui.loss.textContent = loss.toFixed(3); ui.chartLoss.textContent = loss.toFixed(2);
      const progress = Math.max(0, Math.min(100, (initialLoss - loss) / Math.max(initialLoss, .01) * 100));
      ui.progress.textContent = `${progress.toFixed(0)}%`;
      renderMatrix(); renderBars(); drawChart();
      if (refreshSpeech) ui.spoken.textContent = `“${generate(model.cursor + utteranceSeed)}”`;
    }

    function stopTraining() {
      if (timer) clearInterval(timer);
      timer = null; ui.toggle.classList.remove("running"); ui.toggle.innerHTML = "<span>▶</span>开始练习";
    }

    function rebuild(text) {
      stopTraining(); model = makeModel(text); selected = START; history = [meanLoss()]; initialLoss = history[0]; utteranceSeed = 1;
      renderTokens(text); renderAll();
    }

    function trainSteps(count) {
      for (let i = 0; i < count; i++) trainOne();
      history.push(meanLoss()); history = history.slice(-72); renderAll();
    }

    ui.tabs.addEventListener("click", event => {
      const button = event.target.closest("button[data-preset]"); if (!button) return;
      activePreset = button.dataset.preset; ui.input.value = presets[activePreset];
      ui.tabs.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      rebuild(ui.input.value);
    });
    ui.input.addEventListener("input", () => {
      activePreset = "custom"; ui.tabs.querySelectorAll("button").forEach(item => item.classList.remove("active")); renderTokens(ui.input.value);
    });
    $("loadCorpus").addEventListener("click", () => rebuild(ui.input.value));
    ui.matrix.addEventListener("click", event => {
      const target = event.target.closest("[data-row]"); if (!target) return;
      selected = target.dataset.row; renderMatrix(); renderBars();
    });
    $("stepOnce").addEventListener("click", () => trainSteps(1));
    $("fastTrain").addEventListener("click", () => trainSteps(200));
    ui.toggle.addEventListener("click", () => {
      if (timer) { stopTraining(); return; }
      ui.toggle.classList.add("running"); ui.toggle.innerHTML = "<span>Ⅱ</span>先停一下";
      timer = setInterval(() => trainSteps(5), 100);
    });
    $("resetModel").addEventListener("click", () => rebuild(ui.input.value));
    ui.temperature.addEventListener("input", () => {
      temperature = Number(ui.temperature.value); ui.temperatureLabel.textContent = temperature.toFixed(1); renderBars(); ui.spoken.textContent = `“${generate(++utteranceSeed)}”`;
    });
    $("speakAgain").addEventListener("click", () => { ui.spoken.textContent = `“${generate(++utteranceSeed)}”`; });

    ui.input.value = presets.hello;
    rebuild(presets.hello);
  })();