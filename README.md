# LycaClient v1.3

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

# v1.3

hey the third of v1 is here, actually making this one was faster then v1.2. this time, i've added 4 more features to LycaClient and made some upgrades in the UI, but dw the focus is still there on the avoidance of distractions like suggestions etc.

---

### What's new? 

* **repost functionality**: now the client lets you **repost** posts through the button for that, which was just a un-clickable increment stat before.
* **near-full featured posting**: v1.3's posting feature has **most** of the functionalities of the original client now like the image and GIF upload(the GIF upload is a bit tricky as LycaClient is a completely front-end app but i'm working on a workaround), the video upload is still unsupported and will be added in later versions.
* **specific video section**: i've made a new feature, in which when an account is loaded, it shows two sections, one for the normal posts and one wich is only for the videos posted by the person.
* **better-functioning search**: the search bar has got a nice upgrade, of now being case-insensitive and you can also search by display names and the search is now having a drop-down list of the closest matches to the account you're searching for. which makes the entire process way easier.
* **the UI upgrade**: i've upgraded the UI to a more fitting one, as i've replaced the emoji-based buttons(which i felt was a bit out-of-place) for the icons from Lucid. i also changed the theme-switcher from the seperated buttons to a pill-container wrapping the three theme buttons with cubic-bezier animation which looked better and less bloated.

---

