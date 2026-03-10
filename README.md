# LycaClient v.Feather

I built **LycaClient v.Feather** because the modern web is leaving too many people behind. Most social media apps today are bloated with tracking scripts, heavy frameworks, and aggressive algorithms that choke older hardware.

**Feather** is the "ultra-light" sibling to the main LycaClient. It is designed specifically for low-resource environments and devices as old as **15 years**. Whether you're reviving an old 2011 netbook, an early Android tablet, or just living with a painfully slow data connection, Feather is meant to keep you connected to the AT Protocol (Bluesky) without the lag.

---

### The Idea

* **Search-First, Not Algorithm-First**: Like the original LycaClient, Feather doesn't tell you what to see. You search for the handles you want to follow. You control the feed.
* **No Frameworks**: No React, no Vue, no nonsense. It’s written in raw, vanilla JavaScript using `XMLHttpRequest` for maximum compatibility with legacy browsers.
* **Performance is Accessibility**: By using standard CSS layouts instead of modern GPU-heavy effects, I've ensured that even chips from a decade ago can render the UI smoothly.

---

### Technical Info

* **XMLHttpRequest over Fetch**: For compatibility with older browsers.
* **Vanilla DOM Manipulation**: Makes it easier for the CPU and RAM.
* **CSS 2.1**: Better for low resources and is the standard for older browsers.
* **Optimized Injection**: To stop the browser from re-rendering the page for each post.

---

Any bugs reported and new features will be fixed or added in future updates or by others through fork. :) 
