// Calculadora simples anexada aos campos numéricos de "Posições (delays e
// DSM)" — ícone ao lado do campo abre um popup tipo calculadora física
// (teclado, não expressão escrita), e "Aplicar" escreve o resultado no
// campo. Um único popup partilhado é reaproveitado para todos os campos;
// qual o campo-alvo muda a cada abertura. Portado de calc-widget.js dos
// Calculadores (mesmo motivo: no teclado numérico de muitos telemóveis não
// dá para escrever um "-" a sério, só dava para chegar lá pelo "±" daqui).
(function () {
  "use strict";

  var CALC_ICON_SVG =
    '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="2" width="14" height="16" rx="1.6"></rect>' +
    '<rect x="5.5" y="4.3" width="9" height="3.4" rx="0.6" fill="currentColor" stroke="none"></rect>' +
    '<circle cx="6" cy="11" r="0.9" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="10" cy="11" r="0.9" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="14" cy="11" r="0.9" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="6" cy="14.3" r="0.9" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="10" cy="14.3" r="0.9" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="14" cy="14.3" r="0.9" fill="currentColor" stroke="none"></circle>' +
    '</svg>';

  // Em touch, refazer foco no campo após aplicar abre o teclado do sistema
  // e faz a página saltar — só interessa em desktop (conveniência de teclado).
  var IS_TOUCH = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

  var targetInput = null;
  var display = "0";
  var accumulator = 0;
  var pendingOp = null;
  var justEvaluated = false;

  var overlay, displayEl, exprEl;

  function compute(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b === 0 ? NaN : a / b;
    return b;
  }

  // Evita ruído de vírgula flutuante (0.1+0.2 -> 0.30000000000000004) sem
  // arredondar de mais para quem precisa de metros/graus com várias casas.
  function roundClean(n) {
    if (!isFinite(n)) return n;
    return Math.round(n * 1e9) / 1e9;
  }

  function currentResult() {
    var d = parseFloat(display);
    if (isNaN(d)) d = 0;
    if (pendingOp) return roundClean(compute(accumulator, pendingOp, d));
    return roundClean(d);
  }

  function render() {
    displayEl.textContent = display;
    exprEl.textContent = pendingOp ? (formatNum(accumulator) + " " + pendingOp) : "";
  }

  function formatNum(n) {
    return String(roundClean(n));
  }

  function pressDigit(d) {
    if (justEvaluated) { display = d === "." ? "0." : d; justEvaluated = false; return render(); }
    if (d === ".") {
      if (display.indexOf(".") !== -1) return;
      display = display + ".";
      return render();
    }
    display = (display === "0") ? d : display + d;
    render();
  }

  function pressOp(op) {
    var d = parseFloat(display);
    if (isNaN(d)) d = 0;
    if (pendingOp && !justEvaluated) {
      accumulator = roundClean(compute(accumulator, pendingOp, d));
    } else {
      accumulator = d;
    }
    pendingOp = op;
    display = String(accumulator);
    justEvaluated = true;
    render();
  }

  function pressEquals() {
    if (!pendingOp) return;
    var d = parseFloat(display);
    if (isNaN(d)) d = 0;
    accumulator = roundClean(compute(accumulator, pendingOp, d));
    pendingOp = null;
    display = String(accumulator);
    justEvaluated = true;
    render();
  }

  function pressClear() {
    display = "0";
    accumulator = 0;
    pendingOp = null;
    justEvaluated = false;
    render();
  }

  function pressBackspace() {
    if (justEvaluated) return pressClear();
    display = display.length > 1 ? display.slice(0, -1) : "0";
    render();
  }

  function pressSign() {
    var d = parseFloat(display);
    if (isNaN(d) || d === 0) return;
    display = String(roundClean(d * -1));
    render();
  }

  function openFor(input) {
    targetInput = input;
    var seed = parseFloat(input.value);
    display = isNaN(seed) ? "0" : String(seed);
    accumulator = 0;
    pendingOp = null;
    justEvaluated = false;
    render();
    overlay.showModal();
  }

  function close() {
    overlay.close();
    targetInput = null;
  }

  function apply() {
    if (!targetInput) return close();
    var result = currentResult();
    if (isNaN(result)) { close(); return; }
    // O próprio "min"/"max" do campo (definidos em campoAjuste()) limitam o
    // valor aqui -- sem isto, dava para escrever aqui um ângulo fora dos
    // -180..180 que o campo, sozinho, nunca deixaria escrever.
    var min = parseFloat(targetInput.min), max = parseFloat(targetInput.max);
    if (!isNaN(min)) result = Math.max(min, result);
    if (!isNaN(max)) result = Math.min(max, result);
    targetInput.value = String(result);
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    var t = targetInput;
    close();
    if (!IS_TOUCH) t.focus();
  }

  function buildPopup() {
    overlay = document.createElement("dialog");
    overlay.id = "calcw-overlay";
    overlay.setAttribute("aria-label", "Calculadora");
    overlay.innerHTML =
      '<div id="calcw-popup">' +
      '  <div class="calcw-head">' +
      '    <span class="calcw-expr" id="calcw-expr"></span>' +
      '    <button type="button" class="calcw-close" id="calcw-x" aria-label="Fechar">×</button>' +
      '  </div>' +
      '  <div class="calcw-display" id="calcw-display">0</div>' +
      '  <div class="calcw-grid">' +
      '    <button type="button" class="calcw-key calcw-key-fn" data-act="clear">C</button>' +
      '    <button type="button" class="calcw-key calcw-key-fn" data-act="sign">±</button>' +
      '    <button type="button" class="calcw-key calcw-key-fn" data-act="back">⌫</button>' +
      '    <button type="button" class="calcw-key calcw-key-op" data-op="÷">÷</button>' +
      '    <button type="button" class="calcw-key" data-digit="7">7</button>' +
      '    <button type="button" class="calcw-key" data-digit="8">8</button>' +
      '    <button type="button" class="calcw-key" data-digit="9">9</button>' +
      '    <button type="button" class="calcw-key calcw-key-op" data-op="×">×</button>' +
      '    <button type="button" class="calcw-key" data-digit="4">4</button>' +
      '    <button type="button" class="calcw-key" data-digit="5">5</button>' +
      '    <button type="button" class="calcw-key" data-digit="6">6</button>' +
      '    <button type="button" class="calcw-key calcw-key-op" data-op="-">−</button>' +
      '    <button type="button" class="calcw-key" data-digit="1">1</button>' +
      '    <button type="button" class="calcw-key" data-digit="2">2</button>' +
      '    <button type="button" class="calcw-key" data-digit="3">3</button>' +
      '    <button type="button" class="calcw-key calcw-key-op" data-op="+">+</button>' +
      '    <button type="button" class="calcw-key" data-digit="0" style="grid-column: span 2;">0</button>' +
      '    <button type="button" class="calcw-key" data-digit=".">.</button>' +
      '    <button type="button" class="calcw-key calcw-key-eq" data-act="equals">=</button>' +
      '  </div>' +
      '  <button type="button" class="calcw-apply primario" id="calcw-apply">Aplicar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    displayEl = overlay.querySelector("#calcw-display");
    exprEl = overlay.querySelector("#calcw-expr");

    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector("#calcw-x").addEventListener("click", close);
    overlay.querySelector("#calcw-apply").addEventListener("click", apply);
    overlay.querySelectorAll(".calcw-key").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.digit !== undefined) return pressDigit(btn.dataset.digit);
        if (btn.dataset.op) return pressOp(btn.dataset.op);
        if (btn.dataset.act === "equals") return pressEquals();
        if (btn.dataset.act === "clear") return pressClear();
        if (btn.dataset.act === "back") return pressBackspace();
        if (btn.dataset.act === "sign") return pressSign();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (!overlay.open) return;
      if (e.key === "Escape") return close();
      if (e.key >= "0" && e.key <= "9") return pressDigit(e.key);
      if (e.key === ".") return pressDigit(".");
      if (e.key === "+") return pressOp("+");
      if (e.key === "-") return pressOp("-");
      if (e.key === "*") return pressOp("×");
      if (e.key === "/") { e.preventDefault(); return pressOp("÷"); }
      if (e.key === "Enter" || e.key === "=") return pressEquals();
      if (e.key === "Backspace") return pressBackspace();
    });
  }

  // Só os campos de "Posições" (delays e DSM) por agora — são os que têm
  // "rodar"/"tilt" e onde a falta do "-" no teclado do telemóvel foi
  // reportada. Os outros campos numéricos da app continuam com o teclado
  // do sistema, como sempre tiveram.
  function attachIcons() {
    document.querySelectorAll("#listaAjustes .ajuste-campo input[type=\"number\"]").forEach(function (input) {
      var campo = input.closest(".ajuste-campo");
      if (!campo || campo.querySelector(".calcw-btn")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calcw-btn";
      btn.title = "Calculadora — soma, subtrai, multiplica ou divide e aplica o resultado aqui";
      btn.innerHTML = CALC_ICON_SVG;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openFor(input);
      });
      // Antes da unidade ("°"/"m"), que é sempre o último item da grelha.
      campo.insertBefore(btn, campo.lastElementChild);
    });
  }

  function init() {
    buildPopup();
    attachIcons();
    // A lista de "Posições" reconstrói-se do zero a cada remontar da cena
    // (ver desenharAjustes() em app.js) — reaplicar sempre que o DOM muda,
    // agrupado num único rAF por lote em vez de correr a cada mutação.
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; attachIcons(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
