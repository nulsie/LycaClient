# LycaClient v.1.1

LycaClient is an open-source, lightweight Bluesky client built on a simple premise: You should find people, not the other way around. There is no "Discover" tab here. There is no "For You" algorithm. There is just a search bar and the people you actually want to see.

* **Search-First**: Content only appears when you look for it.
* **Zero Noise**: No suggested posts, no ads, no "engagement" traps.
* **Total Transparency**: Every post has a `JSON` button so you can see exactly what the AT Protocol is sending your way.

---

### Features

* **Triple-Themed**: Choose between **Light**, **Dark**, or **Midnight** (Pure AMOLED).
* **Authentication**: Login securely with App Passwords to Like, Reply, and Post.
* **Infinite Scroll**: Smooth, cursor-based pagination that loads only when you're ready.
* **Verification-Aware**: Visual indicators for verified accounts and trusted verifiers and robust verification system adopted from Bsky.
* **Responsive Post, Comment and Like Features**: they are really fast here. 

---

### Built with

I wanted this to be as efficient as possible, so I kept the stack "vanilla":

* **Vanilla JS**: No heavy frameworks.
* **CSS 3**: Custom properties and smooth transitions.
* **AT Protocol(Bsky API)**: Direct interaction with the Bluesky/Atproto XRPC endpoints.

---

### Quick start

Since this is a lightweight client, there’s no `npm` install headache.

1. Clone the repo: `git clone https://github.com/nulsie/LycaClient.git`
2. Open `index.html` in any modern browser.
3. Enter a handle and start exploring.

---

This project is open-source. Feel free to fork it, break it, and make it yours. :) 
