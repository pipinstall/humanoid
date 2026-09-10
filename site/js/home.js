/* Home page: just the animated hero chart. Everything else is server-rendered. */
(function () {
  "use strict";
  var HRI = window.HRI;
  HRI.loadData().then(function (d) {
    var host = document.getElementById("heroChart");
    if (!host) return;
    function draw() {
      host.innerHTML = "";
      host.appendChild(HRI.charts.revealedPerYear(d.robots, { W: 900, H: 300 }));
      host.appendChild(HRI.charts.legendEl(HRI.ERA_ORDER.map(function (e) {
        return [d.eraById[e].name, HRI.eraColor(e)];
      })));
    }
    draw();
    HRI.onThemeChange.push(draw);
  }).catch(function () {});
})();
