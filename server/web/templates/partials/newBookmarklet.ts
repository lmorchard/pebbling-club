// TODO: Might be neat to have a lightweight minifier - this syntax is butts
export default ({
  newUrl,
  popup,
  popupWidth = 600,
  popupHeight = 420,
}: {
  newUrl: string;
  popup?: boolean;
  popupWidth?: number;
  popupHeight?: number;
}) =>
  [
    // Bookmarklets are so cursed...
    `javascript:`,
    // Maybe a cleaner way to get text selection?
    `if(document.getSelection){s=document.getSelection();}else{s='';};`,
    // Pre-fill tags from keyword search parameters in Firefox
    `t="%s";`,
    // Construct the URL params...
    `p=new URLSearchParams({`,
    `href:location.href,`,
    `extended:s,`,
    `title:document.title,`,
    // Weird syntax: in Firefox, %s is a placeholder for keyword search
    // parameters but it's literally "%s" if missing
    `tags:(t[0]==="%"&&t[1]==="s")?"":t,`,
    // Full page or popup?
    popup ? `popup:true,next:"close"` : `next:"same"`,
    `});`,
    `u="${newUrl}?"+p.toString();`,
    popup
      ? // TODO: parameterize the popup width
        `void(window.open(u, "_blank", "width=${popupWidth},height=${popupHeight}"))`
      : `document.location=u`,
  ]
    .filter((s) => !!s)
    .join("");
