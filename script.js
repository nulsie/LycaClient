// --- Authentication State ---
const AUTH_API_BASE = "https://bsky.social/xrpc";
let authSession = null; // Will store the JWT token and user DID
const API_BASE = "https://public.api.bsky.app/xrpc";

// --- State Variables for Infinite Scroll ---
let currentHandle = "";
let currentCursor = null;
let currentProfile = null;
let isLoading = false;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- Authentication Functions ---
async function loginUser() {
    const handle = document.getElementById('loginHandle').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!handle || !password) {
        return showToast("Please enter both handle and App Password.", "error");
    }

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.server.createSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: handle, password: password })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Login failed. Check your credentials.");
        }

        authSession = await res.json();

        // UI Update
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('loginStatus').classList.remove('hidden');
        document.getElementById('loggedInName').innerText = `@${authSession.handle}`;
        document.getElementById('postComposer').classList.remove('hidden');
        
        showToast("Logged in successfully!", "success");
        
        if (currentHandle) fetchUserData();

    } catch (err) {
        showToast(err.message, "error");
    }
}

function logoutUser() {
    authSession = null;
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('loginStatus').classList.add('hidden');
    document.getElementById('loginHandle').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('postComposer').classList.add('hidden');
    if (currentHandle) fetchUserData(); // Refresh to remove like buttons
}

// --- Intersection Observer Setup ---
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && currentCursor && !isLoading) {
        fetchPosts(true); 
    }
}, { rootMargin: "100px" });

async function fetchUserData() {
    const handle = document.getElementById('handleInput').value.trim();
    if (!handle) return showToast("Type a handle, genius!");

    // Reset state for a fresh search
    currentHandle = handle;
    currentCursor = null;
    document.getElementById('feed').innerHTML = ''; 
    
    try {
        // 1. Fetch Profile Details
        const profileRes = await fetch(`${API_BASE}/app.bsky.actor.getProfile?actor=${handle}`);
        if (!profileRes.ok) throw new Error("User not found");
        
        currentProfile = await profileRes.json();
        
        // 2. Fetch Initial User Feed
        await fetchPosts(false);
        
        // Start observing the sentinel
        const sentinel = document.getElementById('scrollSentinel');
        observer.observe(sentinel);
        
    } catch (err) {
        showToast(err.message);
        document.getElementById('profileCard').classList.add('hidden');
    }
}

// Helper function to fetch posts
async function fetchPosts(isPaginating = false) {
    if (!currentHandle) return;
    isLoading = true;
    
    const sentinel = document.getElementById('scrollSentinel');
    if (isPaginating) sentinel.classList.remove('hidden');

    // Dynamically use the Auth API if logged in, otherwise public API
    const baseUrl = authSession ? AUTH_API_BASE : API_BASE;
    let url = `${baseUrl}/app.bsky.feed.getAuthorFeed?actor=${currentHandle}&limit=10`;
    
    if (currentCursor) {
        url += `&cursor=${currentCursor}`;
    }

    try {
        // Set up headers to include our token if we have one
        const headers = {};
        if (authSession) {
            headers['Authorization'] = `Bearer ${authSession.accessJwt}`;
        }

        const feedRes = await fetch(url, { headers });
        const feedData = await feedRes.json();

        // Save the cursor for the next batch.
        currentCursor = feedData.cursor || null;
        
        updateUI(currentProfile, feedData.feed);
        
        if (!currentCursor) {
            sentinel.innerText = "No more posts to show. 🌌";
        }

    } catch (err) {
        console.error("Error fetching feed:", err);
    } finally {
        isLoading = false;
        if (!isPaginating && currentCursor) sentinel.classList.remove('hidden');
    }
} 

function updateUI(profile, posts) {
    document.getElementById('profileCard').classList.remove('hidden');
    
    document.getElementById('pfp').src = profile.avatar || 'https://via.placeholder.com/80';
    document.getElementById('displayName').innerText = profile.displayName || currentHandle;
    document.getElementById('handle').innerText = `@${profile.handle}`;
    document.getElementById('bio').innerText = profile.description || "No bio yet.";
    
    const formatter = new Intl.NumberFormat('en-US', { 
        notation: 'compact', 
        compactDisplay: 'short' 
    });
    
    document.getElementById('followers').innerText = formatter.format(profile.followersCount || 0);
    document.getElementById('following').innerText = formatter.format(profile.followsCount || 0);
    document.getElementById('postsCount').innerText = formatter.format(profile.postsCount || 0);

    const verifiedBadge = document.getElementById('verifiedBadge');
    const trustedBadge = document.getElementById('trustedBadge');

    // Reset visibility
    verifiedBadge.classList.add('hidden');
    trustedBadge.classList.add('hidden');

    // Check official verification status
    if (profile.verification) {
        if (profile.verification.verifiedStatus === 'valid') {
            verifiedBadge.classList.remove('hidden');
        }
        if (profile.verification.trustedVerifierStatus === 'valid') {
            trustedBadge.classList.remove('hidden');
        }
    } else if (profile.handle && !profile.handle.endsWith('.bsky.social')) {
        // Fallback for custom domains
        verifiedBadge.classList.remove('hidden');
    }

    const feedContainer = document.getElementById('feed');
    
    posts.forEach(item => {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';

        // 1. Process Raw Text & Rkey
        const rawText = item.post.record.text || "[No text]";
        const isLongText = rawText.length > 150;

        const uriParts = item.post.uri.split('/');
        const rkey = uriParts[uriParts.length - 1];
        const postUrl = `https://bsky.app/profile/${profile.did}/post/${rkey}`;

        const rawDate = item.post.record.createdAt || item.post.indexedAt;
        const formattedDate = rawDate ? new Date(rawDate).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : "Unknown date";

        const likes = item.post.likeCount ?? 0;
        const reposts = item.post.repostCount ?? 0;
        const replies = item.post.replyCount ?? 0;

        const parentUri = item.post.uri;
        const parentCid = item.post.cid;
        const rootUri = item.post.record.reply ? item.post.record.reply.root.uri : parentUri;
        const rootCid = item.post.record.reply ? item.post.record.reply.root.cid : parentCid;

        // 2. Process Facets & HTML
        const facets = item.post.record.facets || [];
        const richHtml = renderRichText(rawText, facets);

        let textContentHtml = '';
        if (isLongText) {
            textContentHtml = `
                <div class="post-text-container">
                    <div class="post-full clamped" id="text-${rkey}">${richHtml}</div>
                    <button class="read-more-btn" onclick="toggleTextClamped('text-${rkey}', this)">Read More</button>
                </div>
            `;
        } else {
            textContentHtml = `<div class="post-full">${richHtml}</div>`;
        }

        // 3. Process Like State
        let likeButtonHtml = `❤️ <b>${likes}</b>`;
        if (authSession) {
            if (item.post.viewer && item.post.viewer.like) {
                const likeUriParts = item.post.viewer.like.split('/');
                const existingLikeRkey = likeUriParts[likeUriParts.length - 1];
                const originalLikes = Math.max(0, likes - 1); 
                
                likeButtonHtml = `
                    <button class="like-btn active-like" onclick="unlikePost('${item.post.uri}', '${item.post.cid}', '${rkey}', '${existingLikeRkey}', ${originalLikes})">
                        ❤️ <b>${likes}</b>
                    </button>`;
            } else {
                likeButtonHtml = `
                    <button class="like-btn" onclick="likePost('${item.post.uri}', '${item.post.cid}', '${rkey}', ${likes})">
                        🤍 <b>${likes}</b>
                    </button>`;
            }
        }

// 4. Process Embeds
        let embedHtml = ''; 
        let videoDataToInit = null; // Store video data to initialize after rendering

        if (item.post.embed) {
            if (item.post.embed.$type === 'app.bsky.embed.images#view' || item.post.embed.images) {
                // ... (Keep your existing image logic) ...
                embedHtml = `<div class="post-gallery">`;
                item.post.embed.images.forEach(img => {
                    embedHtml += `<img src="${img.thumb}" class="post-img" alt="${img.alt || 'post image'}" onclick="openLightbox('${img.fullsize}')">`; 
                });
                embedHtml += `</div>`;
            } else if (item.post.embed.$type === 'app.bsky.embed.video#view') {
                // 🎬 NEW: Video Embed Handling
                const video = item.post.embed;
                const videoId = `bsky-video-${rkey}`;
                
                embedHtml = `
                    <div class="embed-card video-card">
                        <video id="${videoId}" class="post-video" controls poster="${video.thumbnail}" preload="none"></video>
                    </div>
                `;
                
                // Save the data to initialize the HLS player after the DOM updates
                videoDataToInit = { id: videoId, playlist: video.playlist };

} else if (item.post.embed.$type === 'app.bsky.embed.external#view') {
    const ext = item.post.embed.external;
    embedHtml = `
        <a href="${ext.uri}" target="_blank" class="embed-card external-card">
            ${ext.thumb ? `<img src="${ext.thumb}" class="embed-thumb" alt="Link thumbnail">` : ''}
            <div class="embed-content">
                <div class="embed-title">${escapeHTML(ext.title || 'Link')}</div>
                <div class="embed-description">${escapeHTML(ext.description || '')}</div>
                <div class="embed-uri">🔗 ${new URL(ext.uri).hostname}</div>
            </div>
        </a>
    `;
} else if (item.post.embed.$type === 'app.bsky.embed.record#view') {
    const record = item.post.embed.record;
    
    // Check if it's a standard post record view
    if (record.$type === 'app.bsky.embed.record#viewRecord') {
        embedHtml = `
            <div class="embed-card quote-card">
                <div class="quote-header">
                    <img src="${record.author.avatar || 'https://via.placeholder.com/20'}" class="quote-avatar">
                    <span class="quote-author">
                        <b>${escapeHTML(record.author.displayName || record.author.handle)}</b> 
                        @${record.author.handle}
                    </span>
                </div>
                <p class="quote-text">${escapeHTML(record.value.text || '')}</p>
            </div>
        `;
    }
        }

        // 5. Construct Final HTML
        postDiv.innerHTML = `
            <div class="post-date">🕒 ${formattedDate}</div> 
            <div class="post-preview">${textContentHtml}</div>
            ${embedHtml} 
            <div class="post-stats">
                <span class="stat-item" onclick="toggleAndLoadReplies('${item.post.uri}', '${rkey}')">💬 <b>${replies}</b></span>
                <span class="stat-item">🔁 <b>${reposts}</b></span>
                <span class="stat-item" id="like-container-${rkey}">${likeButtonHtml}</span>
            </div>
            <div class="post-actions">
                ${authSession ? `<button class="reply-toggle-btn" onclick="toggleReplyBox('${rkey}')">↩️ Reply</button>` : ''}
                <a href="${postUrl}" target="_blank" class="post-link">View Post →</a>
            </div>
            ${authSession ? `
            <div id="reply-container-${rkey}" class="reply-container hidden">
                <textarea id="reply-input-${rkey}" class="reply-input" placeholder="Post your reply..."></textarea>
                <button class="submit-reply-btn" onclick="submitReply('${parentUri}', '${parentCid}', '${rootUri}', '${rootCid}', '${rkey}')">Post Reply</button>
            </div>
            ` : ''}
            <div id="thread-container-${rkey}" class="thread-container hidden"></div>
        `;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerText = '💾 JSON';
        downloadBtn.onclick = () => downloadPostJson(item.post);
        postDiv.querySelector('.post-actions').appendChild(downloadBtn);
        
        feedContainer.appendChild(postDiv);
        // 🎬 NEW: Initialize HLS for the video if one exists in this post
        if (videoDataToInit) {
            const videoElement = document.getElementById(videoDataToInit.id);
            if (videoElement) {
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(videoDataToInit.playlist);
                    hls.attachMedia(videoElement);
                }
                // Fallback for Safari which supports native HLS
                else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    videoElement.src = videoDataToInit.playlist;
                }
            }
        }
    }});
}

// --- GLOBAL FUNCTIONS & LISTENERS ---

function downloadPostJson(postData) {
    const jsonString = JSON.stringify(postData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    
    const fileId = postData.cid ? postData.cid.substring(0, 8) : 'unknown';
    downloadAnchorNode.setAttribute("download", `post_${fileId}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
}

// Global Event Listeners for Verified Badges
function showBadgePopup(event, text) {
    if (document.querySelector('.verified-popup')) return;

    const notification = document.createElement('span');
    notification.innerText = text;
    notification.className = 'verified-popup';

    event.currentTarget.parentElement.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 1500);
}

document.getElementById('verifiedBadge').addEventListener('click', (e) => showBadgePopup(e, 'Verified Account'));
document.getElementById('trustedBadge').addEventListener('click', (e) => showBadgePopup(e, 'Trusted Verifier'));

// --- Like Functionality ---
async function likePost(postUri, postCid, postRkey, currentLikes) {
    if (!authSession) return showToast("You must be logged in to like a post.");

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.like",
                record: {
                    $type: "app.bsky.feed.like",
                    subject: { uri: postUri, cid: postCid },
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to like post");
        }

        const data = await res.json();
        
        // Fixed: Properly extract URI parts
        const uriParts = data.uri.split('/');
        const likeRkey = uriParts[uriParts.length - 1];

        const container = document.getElementById(`like-container-${postRkey}`);
        container.innerHTML = `
            <button class="like-btn active-like" onclick="unlikePost('${postUri}', '${postCid}', '${postRkey}', '${likeRkey}', ${currentLikes})">
                ❤️ <b>${currentLikes + 1}</b>
            </button>`;

    } catch (err) {
        console.error(err);
        showToast("Error liking post: " + err.message);
    }
}

// --- Unlike Functionality ---
async function unlikePost(postUri, postCid, postRkey, likeRkey, originalLikes) {
    if (!authSession) return showToast("You must be logged in to unlike a post.");

    try {
        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.deleteRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did,
                collection: "app.bsky.feed.like",
                rkey: likeRkey
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to unlike post");
        }

        const container = document.getElementById(`like-container-${postRkey}`);
        container.innerHTML = `
            <button class="like-btn" onclick="likePost('${postUri}', '${postCid}', '${postRkey}', ${originalLikes})">
                🤍 <b>${originalLikes}</b>
            </button>`;

    } catch (err) {
        console.error(err);
        showToast("Error unliking post: " + err.message);
    }
}

// --- Reply Functionality ---
function toggleReplyBox(rkey) {
    const box = document.getElementById(`reply-container-${rkey}`);
    box.classList.toggle('hidden');
}

// --- Reply Functionality ---
async function submitReply(parentUri, parentCid, rootUri, rootCid, rkey) {
    if (!authSession) return showToast("You must be logged in to reply.", "error");

    const inputEl = document.getElementById(`reply-input-${rkey}`);
    const text = inputEl.value.trim();

    if (!text) return showToast("Reply cannot be empty!", "error");

    try {
        // Generate facets for the reply text before posting
        const generatedFacets = await parseFacets(text);

        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.post",
                record: {
                    $type: "app.bsky.feed.post",
                    text: text,
                    createdAt: new Date().toISOString(),
                    // Inject facets here if the parser found any
                    ...(generatedFacets && { facets: generatedFacets }), 
                    reply: {
                        root: { uri: rootUri, cid: rootCid },
                        parent: { uri: parentUri, cid: parentCid }
                    }
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to post reply");
        }

        showToast("Reply posted successfully!", "success");
        inputEl.value = ""; 
        toggleReplyBox(rkey); 

    } catch (err) {
        console.error(err);
        showToast("Error posting reply: " + err.message, "error");
    }
}

// --- Create New Post Function ---
// --- Create New Post Function ---
async function submitPost() {
    if (!authSession) return showToast("You must be logged in to post.", "error");

    const inputEl = document.getElementById('new-post-input');
    const text = inputEl.value.trim();

    if (!text) return showToast("Post cannot be empty!", "error");

    try {
        // Generate facets right before posting
        const generatedFacets = await parseFacets(text);

        const res = await fetch(`${AUTH_API_BASE}/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authSession.accessJwt}` 
            },
            body: JSON.stringify({
                repo: authSession.did, 
                collection: "app.bsky.feed.post",
                record: {
                    $type: "app.bsky.feed.post",
                    text: text,
                    createdAt: new Date().toISOString(),
                    // Inject facets if we found any
                    ...(generatedFacets && { facets: generatedFacets }) 
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to create post");
        }

        showToast("Post published successfully!", "success");
        inputEl.value = "";
        
        if (currentHandle && currentHandle.toLowerCase() === authSession.handle.toLowerCase()) {
             fetchUserData();
        }

    } catch (err) {
        console.error(err);
        showToast("Error publishing post: " + err.message, "error");
    }
}

// --- Lightbox Functions ---
window.openLightbox = function(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    if (!lb || !img) return; 
    
    img.src = src;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb) {
        lb.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
};

// --- Load Thread/Replies Function ---
async function toggleAndLoadReplies(postUri, rkey) {
    const container = document.getElementById(`thread-container-${rkey}`);

    if (!container.classList.contains('hidden')) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = '<div class="loading-replies">Loading replies... ☁️</div>';

    const baseUrl = authSession ? AUTH_API_BASE : API_BASE;
    const url = `${baseUrl}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}&depth=1`;

    try {
        const headers = {};
        if (authSession) {
            headers['Authorization'] = `Bearer ${authSession.accessJwt}`;
        }

        const res = await fetch(url, { headers });
        const data = await res.json();

        if (!data.thread || !data.thread.replies || data.thread.replies.length === 0) {
            container.innerHTML = '<div class="no-replies">No replies yet. 🦗</div>';
            return;
        }

        let repliesHtml = '';
        
        data.thread.replies.forEach(replyNode => {
            const replyPost = replyNode.post;
            if (!replyPost) return;

            const author = replyPost.author;
            const text = replyPost.record.text || '[No text]';
            
            const date = replyPost.record.createdAt ? new Date(replyPost.record.createdAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Unknown date';

            repliesHtml += `
                <div class="reply-item">
                    <div class="reply-header">
                        <img src="${author.avatar || 'https://via.placeholder.com/30'}" class="reply-avatar">
                        <div class="reply-author-info">
                            <b>${author.displayName || author.handle}</b> <span class="reply-handle">@${author.handle}</span>
                            <div class="reply-date">${date}</div>
                        </div>
                    </div>
                    <p class="reply-text">${text}</p>
                </div>
            `;
        });

        container.innerHTML = repliesHtml;

    } catch (err) {
        console.error("Error loading replies:", err);
        container.innerHTML = '<div class="error-replies">Failed to load replies. ❌</div>';
    }
}

// --- Rich Text & Facet Handling ---
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            "'": '&#39;', '"': '&quot;'
        }[tag])
    );
}

function renderRichText(text, facets) {
    if (!text) return "";
    if (!facets || facets.length === 0) return escapeHTML(text).replace(/\n/g, '<br>');

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const bytes = encoder.encode(text);

    let html = '';
    let lastByte = 0;

    facets.sort((a, b) => a.index.byteStart - b.index.byteStart);

    for (const facet of facets) {
        if (facet.index.byteStart > lastByte) {
            const beforeBytes = bytes.slice(lastByte, facet.index.byteStart);
            html += escapeHTML(decoder.decode(beforeBytes));
        }

        const facetBytes = bytes.slice(facet.index.byteStart, facet.index.byteEnd);
        const facetText = escapeHTML(decoder.decode(facetBytes));

        const feature = facet.features[0];
        if (feature.$type === 'app.bsky.richtext.facet#mention') {
            html += `<a href="#" class="facet-link mention" onclick="document.getElementById('handleInput').value='${feature.did}'; fetchUserData(); return false;">${facetText}</a>`;
        } else if (feature.$type === 'app.bsky.richtext.facet#link') {
            html += `<a href="${feature.uri}" target="_blank" class="facet-link external">${facetText}</a>`;
        } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
            html += `<a href="https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}" target="_blank" class="facet-link tag">${facetText}</a>`;
        } else {
            html += facetText;
        }

        lastByte = facet.index.byteEnd;
    }

    if (lastByte < bytes.length) {
        const afterBytes = bytes.slice(lastByte);
        html += escapeHTML(decoder.decode(afterBytes));
    }

    return html.replace(/\n/g, '<br>'); 
}

function toggleTextClamped(elementId, btn) {
    const el = document.getElementById(elementId);
    if (el.classList.contains('clamped')) {
        el.classList.remove('clamped');
        btn.innerText = 'Show Less';
    } else {
        el.classList.add('clamped');
        btn.innerText = 'Read More';
    }
}
 // --- Rich Text Facet Generator ---
async function parseFacets(text) {
    const facets = [];
    const encoder = new TextEncoder();

    // Helper to get the exact UTF-8 byte index
    const getByteStart = (index) => encoder.encode(text.substring(0, index)).byteLength;

    // 1. Parse Links (URLs)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        let uri = match[0];
        // Strip trailing punctuation often caught in URLs
        if (/[.,;!?]$/.test(uri)) uri = uri.slice(0, -1);
        
        const byteStart = getByteStart(match.index);
        const byteEnd = byteStart + encoder.encode(uri).byteLength;
        
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri }]
        });
    }

    // 2. Parse Hashtags
    const tagRegex = /(?:^|\s)(#[^\s]+)/g; 
    while ((match = tagRegex.exec(text)) !== null) {
        let tagWithHash = match[1];
        tagWithHash = tagWithHash.replace(/[.,;!?]+$/, ''); // Strip trailing punctuation
        const tag = tagWithHash.substring(1); // Remove the '#'
        const matchIndex = match[0].indexOf(tagWithHash) + match.index;
        
        const byteStart = getByteStart(matchIndex);
        const byteEnd = byteStart + encoder.encode(tagWithHash).byteLength;
        
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#tag', tag }]
        });
    }

    // 3. Parse Mentions (Requires API call to resolve DID)
    const mentionRegex = /(?:^|\s)(@[a-zA-Z0-9.-]+)/g;
    while ((match = mentionRegex.exec(text)) !== null) {
        let mentionWithAt = match[1];
        mentionWithAt = mentionWithAt.replace(/[.,;!?]+$/, ''); // Strip trailing punctuation
        const handle = mentionWithAt.substring(1); // Remove the '@'
        const matchIndex = match[0].indexOf(mentionWithAt) + match.index;
        
        const byteStart = getByteStart(matchIndex);
        const byteEnd = byteStart + encoder.encode(mentionWithAt).byteLength;
        
        try {
            // AT Protocol requires the user's DID for a mention, not just their handle
            const res = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
            if (res.ok) {
                const data = await res.json();
                facets.push({
                    index: { byteStart, byteEnd },
                    features: [{ $type: 'app.bsky.richtext.facet#mention', did: data.did }]
                });
            }
        } catch (err) {
            console.warn(`Could not resolve mention for ${handle}`);
        }
    }

    return facets.length > 0 ? facets : undefined;
}