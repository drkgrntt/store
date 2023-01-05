export const priceToCurrency = (price: number) => {
  return `$${(price / 100).toFixed(2)}`;
};

export const combineClasses = (...classNames: string[]) => {
  return classNames.filter(Boolean).join(" ").trim();
};

export const substring = (string: string, length = 100): [string, boolean] => {
  if (string.length <= length) return [string, false];
  return [`${string.substring(0, length).trim()}...`, true];
};

export const emptyValue = (value: number | boolean | string | unknown) => {
  switch (typeof value) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "string":
    default:
      return "";
  }
};

export const ucFirst = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const range = (size: number) => {
  return [...Array(size).keys()];
};

export const debounce = <Args extends unknown[]>(
  func: (...args: Args) => void,
  wait = 300
) => {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Args) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

type Browser = "chrome" | "firefox" | "edge" | "safari" | "opera";
export const getBrowser = (): Browser | null => {
  // Currently supporting browsers with Push API support
  const { userAgent } = navigator;
  const chrome = /chrome|chromium|crios/i;
  const firefox = /firefox|fxios/i;
  const safari = /safari/i;
  const opera = /opr\//i;
  const edge = /edg/i;

  switch (true) {
    case chrome.test(userAgent):
      return "chrome";
    case firefox.test(userAgent):
      return "firefox";
    case edge.test(userAgent):
      return "edge";
    case safari.test(userAgent):
      return "safari";
    case opera.test(userAgent):
      return "opera";
    default:
      return null;
  }
};

type MobileOS = "windows" | "android" | "ios";
export const getMobileOperatingSystem = (): MobileOS | null => {
  var userAgent = navigator.userAgent || navigator.vendor;

  const windows = /windows phone/i;
  const android = /android/i;
  const ios = /iPad|iPhone|iPod/;

  switch (true) {
    // Windows Phone must come first because its UA also contains "Android"
    case windows.test(userAgent):
      return "windows";
    case android.test(userAgent):
      return "android";
    case ios.test(userAgent):
      return "ios";
    default:
      return null;
  }
};

export const getLocalDateString = (date: Date) => {
  return new Date(
    new Date(date).setMinutes(date.getTimezoneOffset())
  ).toLocaleDateString();
};
