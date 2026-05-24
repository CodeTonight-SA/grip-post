// grip-post side panel
// W3 will wire Unicode transforms and anti-fluff gate here.

const btnFormat = document.getElementById("btn-format");
const btnCheck = document.getElementById("btn-check");
const output = document.getElementById("output");

function setOutput(text: string): void {
  if (output) {
    output.textContent = text;
  }
}

btnFormat?.addEventListener("click", () => {
  setOutput("Format: coming in W3.");
});

btnCheck?.addEventListener("click", () => {
  setOutput("Fluff check: coming in W4.");
});
