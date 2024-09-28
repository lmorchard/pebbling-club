import "./theme-selector.css";

// adapted from https://stackoverflow.com/questions/56300132/how-to-override-css-prefers-color-scheme-setting/75124760#75124760
class ThemeSelector extends HTMLElement {
  connectedCallback() {
    const scheme = this.getPreferredColorScheme();
    this.applyPreferredColorScheme(scheme);

    const checkbox: HTMLInputElement | null = this.querySelector(
      "input[type=checkbox]"
    );
    if (checkbox) {
      checkbox.checked = scheme === "light";
      checkbox.addEventListener("change", () => {
        this.changeColorScheme(checkbox.checked ? "light" : "dark");
      });
    }
  }

  changeColorScheme(newScheme: string) {
    this.applyPreferredColorScheme(newScheme);
    this.savePreferredColorScheme(newScheme);
  }

  getPreferredColorScheme() {
    let systemScheme = "light";
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      systemScheme = "dark";
    }
    let chosenScheme = localStorage.getItem("scheme") || systemScheme;
    if (systemScheme === chosenScheme) {
      localStorage.removeItem("scheme");
    }
    return chosenScheme;
  }

  savePreferredColorScheme(scheme: string) {
    let systemScheme = "light";
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      systemScheme = "dark";
    }
    if (systemScheme === scheme) {
      localStorage.removeItem("scheme");
    } else {
      localStorage.setItem("scheme", scheme);
    }
  }

  applyPreferredColorScheme(scheme: string) {
    for (let s = 0; s < document.styleSheets.length; s++) {
      try {
        for (let i = 0; i < document.styleSheets[s].cssRules.length; i++) {
          const rule = document.styleSheets[s].cssRules[i];
          if (
            rule &&
            rule instanceof CSSMediaRule &&
            rule.media &&
            rule.media.mediaText.includes("prefers-color-scheme")
          ) {
            switch (scheme) {
              case "light":
                rule.media.appendMedium("original-prefers-color-scheme");
                if (rule.media.mediaText.includes("light"))
                  rule.media.deleteMedium("(prefers-color-scheme: light)");
                if (rule.media.mediaText.includes("dark"))
                  rule.media.deleteMedium("(prefers-color-scheme: dark)");
                break;
              case "dark":
                rule.media.appendMedium("(prefers-color-scheme: light)");
                rule.media.appendMedium("(prefers-color-scheme: dark)");
                if (rule.media.mediaText.includes("original"))
                  rule.media.deleteMedium("original-prefers-color-scheme");
                break;
              default:
                rule.media.appendMedium("(prefers-color-scheme: dark)");
                if (rule.media.mediaText.includes("light"))
                  rule.media.deleteMedium("(prefers-color-scheme: light)");
                if (rule.media.mediaText.includes("original"))
                  rule.media.deleteMedium("original-prefers-color-scheme");
                break;
            }
          }
        }
      } catch (error) {
        // ignore "Not allowed to access cross-origin stylesheet" errors
        // from external stylesheets (e.g. Google Fonts)
        if (
          error instanceof Error &&
          "name" in error &&
          error.name === "SecurityError"
        )
          continue;
        console.warn("theme selector problem:", error);
      }
    }
  }
}

customElements.define("theme-selector", ThemeSelector);
