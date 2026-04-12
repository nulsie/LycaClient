#LycaClient v1.2

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
* **No need of making an account**: You can view accounts and their posts without even having a Bsky account by just searching(but of course reactions and posting needs logging in). 

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

# v1.2
###### updated, and now v1.2.1

The second version is here, i've added two new features and made the structure and readability of the code better.

---

### What's new in v.1.2? 

* **HLS Video Support**: Now the client supports videos through **HLS**.
* **Facet Parsing**: v.1.2, unlike v.1.1 supports and parses facets like **hashtags, mentions and links** and makes them interact.
* **Better code readability**: i think i've made the [**script.js**](https://github.com/nulsie/LycaClient/blob/v.1.2/script.js) more readable and better structured.

---

### Built with the same stuff

* **Vanilla JS**: No heavy frameworks.
* **CSS 3**: Custom properties and smooth transitions.
* **AT Protocol(Bsky API)**: Direct interaction with the Bluesky/Atproto XRPC endpoints.

---

### How to start using

As same as before:

1. Clone the repo: `git clone https://github.com/nulsie/LycaClient.git`
2. Open `index.html` in any modern browser.
3. Enter a handle and start exploring.

---

### v1.2.1 is here

i've added a minor update to v1.2 which fixes a bug and a new feature.

#### What's new?

* **bug fix:** fixed the bug which caused repetition of posts.
* **GIF support:** now LycaClient supports the GIF format.

and that's it. v1.3 will be there soon.

---

again saying that this project is open-source. Feel free to fork it, break it, and make it yours. :)

**Look**: the [**Feather**](https://github.com/nulsie/LycaClient/tree/v.Feather) version of LycaClient is still there.
