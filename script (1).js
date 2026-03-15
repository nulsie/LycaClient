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

        // The Fix: Bluesky returns error details in the JSON body for non-OK responses
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Login failed. Check your credentials.");
        }

        authSession = await res.json();

        // UI Update (only happens if the code didn't "throw" above)
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('loginStatus').classList.remove('hidden');
        document.getElementById('loggedInName').innerText = `@${authSession.handle}`;
        document.getElementById('postComposer').classList.remove('hidden')
        
        showToast("Logged in successfully!", "success");
        
        if (currentHandle) fetchUserData();

    } catch (err) {
        // This will now catch both network errors and the "Login failed" error above
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

// 1. Inside fetchUserData function, replace the old badge logic with this:
const verifiedBadge = document.getElementById('verifiedBadge');
const trustedBadge = document.getElementById('trustedBadge');

// Reset visibility
verifiedBadge.classList.add('hidden');
trustedBadge.classList.add('hidden');

// Check official April 2025 verification status
if (profile.verification) {
    if (profile.verification.verifiedStatus === 'valid') {
        verifiedBadge.classList.remove('hidden');
    }
    if (profile.verification.trustedVerifierStatus === 'valid') {
        trustedBadge.classList.remove('hidden');
    }
} 
// Fallback for custom domains (Optional)
else if (profile.handle && !profile.handle.endsWith('.bsky.social')) {
    verifiedBadge.classList.remove('hidden');
}

// 2. Replace the event listener at the bottom of script.js with this unified logic:
function showBadgePopup(event, text) {
    if (document.querySelector('.verified-popup')) return;

    const notification = document.createElement('span');
    notification.innerText = text;
    notification.className = 'verified-popup';

    // Append to the name-wrapper so it positions correctly
    event.currentTarget.parentElement.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 1500);
}

// Attach listeners to both badges
document.getElementById('verifiedBadge').onclick = (e) => showBadgePopup(e, 'Verified Account');
document.getElementById('trustedBadge').onclick = (e) => showBadgePopup(e, 'Trusted Verifier');

    const feedContainer = document.getElementById('feed');
    
    posts.forEach(item => {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';

        const likes = item.post.likeCount ?? 0;
        const reposts = item.post.repostCount ?? 0;
        const replies = item.post.replyCount ?? 0;

        const text = item.post.record.text || "[No text]";
        const uriParts = item.post.uri.split('/');
        
        const rkey = uriParts[uriParts.length - 1]; 
        const postUrl = `https://bsky.app/profile/${profile.did}/post/${rkey}`;
        
    // 🆕 ADD THIS: Extract and format the date
const rawDate = item.post.record.createdAt || item.post.indexedAt;
const formattedDate = rawDate ? new Date(rawDate).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
}) : "Unknown date";

 const isLongText = text.length > 100;
    const previewText = isLongText ? text.substring(0, 100) + "..." : text;
    
    const parentUri = item.post.uri;
        const parentCid = item.post.cid;
        // If the post is already a reply, inherit its root. Otherwise, this post IS the root.

        // ... existing code ...
        const rootUri = item.post.record.reply ? item.post.record.reply.root.uri : parentUri;
        const rootCid = item.post.record.reply ? item.post.record.reply.root.cid : parentCid
        // ... (keep your existing URI/CID logic above this)

        // --- CHECK IF LOGGED-IN USER LIKED IT ---
        let likeButtonHtml = `❤️ <b>${likes}</b>`; // Default fallback if not logged in

        if (authSession) {
            // Bluesky passes user-specific state in the 'viewer' object
            if (item.post.viewer && item.post.viewer.like) {
                // User has liked it. Extract the rkey of their specific like.
                const likeUriParts = item.post.viewer.like.split('/');
                const existingLikeRkey = likeUriParts[likeUriParts.length - 1];
                const originalLikes = Math.max(0, likes - 1); // The count if they unlike it
                
                likeButtonHtml = `
                    <button class="like-btn active-like" onclick="unlikePost('${item.post.uri}', '${item.post.cid}', '${rkey}', '${existingLikeRkey}', ${originalLikes})">
                        ❤️ <b>${likes}</b>
                    </button>`;
            } else {
                // User has NOT liked it
                likeButtonHtml = `
                    <button class="like-btn" onclick="likePost('${item.post.uri}', '${item.post.cid}', '${rkey}', ${likes})">
                        🤍 <b>${likes}</b>
                    </button>`;
            }
        }
        // -----------------------------------------


    let textContentHtml = '';
    if (isLongText) {
        textContentHtml = `
            <div class="post-text-container">
                <p class="post-preview" id="preview-${rkey}">${previewText}</p>
                <p class="post-full hidden" id="full-${rkey}">${text}</p>
                <button class="read-more-btn" onclick="toggleText('${rkey}', this)">Read More</button>
            </div>
        `;
    } else {
        textContentHtml = `<p class="post-preview">${text}</p>`;
    }

// --- Expanded Embed Handling ---
let embedHtml = ''; 

if (item.post.embed) {
    // 1. Handle Images (Existing)
// Inside your updateUI loop...
if (item.post.embed.$type === 'app.bsky.embed.images#view' || item.post.embed.images) {
    embedHtml = `<div class="post-gallery">`;
    item.post.embed.images.forEach(img => {
        // We added the onclick="openLightbox(...)" here!
        embedHtml += `
            <img src="${img.thumb}" 
                 class="post-img" 
                 alt="${img.alt || 'post image'}" 
                 onclick="openLightbox('${img.fullsize}')">`; 
    });
    embedHtml += `</div>`;
} 
    // 2. Handle External Links (Link Cards)
    else if (item.post.embed.$type === 'app.bsky.embed.external#view') {
        const external = item.post.embed.external;
        embedHtml = `
            <a href="${external.uri}" target="_blank" class="embed-card external-card">
                ${external.thumb ? `<img src="${external.thumb}" class="embed-thumb">` : ''}
                <div class="embed-content">
                    <span class="embed-title">${external.title || 'Link'}</span>
                    <p class="embed-description">${external.description || ''}</p>
                    <span class="embed-uri">🔗 ${new URL(external.uri).hostname}</span>
                </div>
            </a>
        `;
    }
    // 3. Handle Quote Posts (Inner Cards)
    else if (item.post.embed.$type === 'app.bsky.embed.record#view') {
        const record = item.post.embed.record;
        // Check if the record is a valid post view
        if (record.$type === 'app.bsky.embed.record#viewRecord') {
            embedHtml = `
                <div class="embed-card quote-card">
                    <div class="quote-header">
                        <img src="${record.author.avatar || ''}" class="quote-avatar">
                        <span class="quote-author"><b>${record.author.displayName}</b> @${record.author.handle}</span>
                    </div>
                    <p class="quote-text">${record.value.text || ''}</p>
                </div>
            `;
        }
    }
}

        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;

        // Build the HTML without the download button first
        postDiv.innerHTML = `
            <div class="post-date">🕒 ${formattedDate}</div> <p class="post-preview">${textContentHtml}</p>
            ${embedHtml} 
            <div class="post-stats">
        <span class="stat-item" onclick="toggleAndLoadReplies('${item.post.uri}', '${rkey}')">💬 <b>${replies}</b></span>
        <span class="stat-item">🔁 <b>${reposts}</b></span>
        <span class="stat-item" id="like-container-${rkey}">${likeButtonHtml}</span>
    </div>
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
         </div>
         <div id="thread-container-${rkey}" class="thread-container hidden"></div>
        `;
        
        // Safely create the button and attach the JSON data in memory
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerText = '💾 JSON';
        downloadBtn.onclick = () => downloadPostJson(item.post);
        
        // Append the safely created button to the actions div
        postDiv.querySelector('.post-actions').appendChild(downloadBtn);
        
        feedContainer.appendChild(postDiv);
    });
}

// --- GLOBAL FUNCTIONS & LISTENERS ---

// Moved out of the loop to be accessible by inline onclick
function downloadPostJson(postData) {
    // Create a Blob from the JSON string
    const jsonString = JSON.stringify(postData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a temporary object URL for the Blob
    const url = URL.createObjectURL(blob);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    
    // Safely handle the CID for the filename [cite: 31]
    const fileId = postData.cid ? postData.cid.substring(0, 8) : 'unknown';
    downloadAnchorNode.setAttribute("download", `post_${fileId}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    // Clean up the URL object to prevent memory leaks
    URL.revokeObjectURL(url);
}

// Moved out of updateUI so it doesn't get duplicated on pagination
document.getElementById('verifiedBadge').addEventListener('click', function() {
    if (document.querySelector('.verified-popup')) return;

    const notification = document.createElement('span');
    notification.innerText = 'Verified Account';
    notification.className = 'verified-popup';

    const wrapper = document.querySelector('.name-wrapper');
    wrapper.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 1200);
});
 // --- Like Functionality ---
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
                    subject: {
                        uri: postUri,
                        cid: postCid
                    },
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to like post");
        }

        // 1. Get the data from the response
        const data = await res.json();
        
        // 2. Extract the rkey of the LIKE record (it's the last part of the returned URI)
        const uriParts = data.uri.split('/');
        const likeRkey = uriParts[uriParts.length - 1];

        // 3. Update UI to an "Unlike" button, passing the new likeRkey
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
                rkey: likeRkey // The specific ID of the like we want to delete
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to unlike post");
        }

        // Revert the UI back to the unliked state
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

 // --- Text Toggle Function ---
function toggleText(rkey, btn) {
    const previewEl = document.getElementById(`preview-${rkey}`);
    const fullEl = document.getElementById(`full-${rkey}`);

    if (fullEl.classList.contains('hidden')) {
        // Expand
        previewEl.classList.add('hidden');
        fullEl.classList.remove('hidden');
        btn.innerText = 'Show Less';
    } else {
        // Collapse
        fullEl.classList.add('hidden');
        previewEl.classList.remove('hidden');
        btn.innerText = 'Read More';
    }
}
 // --- Reply Functionality ---
function toggleReplyBox(rkey) {
    const box = document.getElementById(`reply-container-${rkey}`);
    if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
}

async function submitReply(parentUri, parentCid, rootUri, rootCid, rkey) {
    if (!authSession) return showToast("You must be logged in to reply.", "error");

    const inputEl = document.getElementById(`reply-input-${rkey}`);
    const text = inputEl.value.trim();

    if (!text) return showToast("Reply cannot be empty!", "error");

    try {
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
        inputEl.value = ""; // Clear the box
        toggleReplyBox(rkey); // Hide the box again

    } catch (err) {
        console.error(err);
        showToast("Error posting reply: " + err.message, "error");
    }
}

 // --- Create New Post Function ---
async function submitPost() {
    if (!authSession) return showToast("You must be logged in to post.", "error");

    const inputEl = document.getElementById('new-post-input');
    const text = inputEl.value.trim();

    if (!text) return showToast("Post cannot be empty!", "error");

    try {
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
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Failed to create post");
        }

        showToast("Post published successfully!", "success");
        inputEl.value = ""; // Clear the text box
        
        // Optional: Refresh the feed if you are viewing your own profile
        if (currentHandle && currentHandle.toLowerCase() === authSession.handle.toLowerCase()) {
             fetchUserData();
        }

    } catch (err) {
        console.error(err);
        showToast("Error publishing post: " + err.message, "error");
    }
}
 // --- Lightbox Functions ---
// --- LIGHTBOX CONTROLS ---
// We attach these to 'window' to ensure the HTML onclick can always see them
window.openLightbox = function(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    if (!lb || !img) return; // Safety check
    
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

    // If it's already open, clicking again closes it
    if (!container.classList.contains('hidden')) {
        container.classList.add('hidden');
        return;
    }

    // Open it and show a loading state
    container.classList.remove('hidden');
    container.innerHTML = '<div class="loading-replies">Loading replies... ☁️</div>';

    // Fetch the thread (depth=1 so we don't load massive 100-comment chains all at once)
    const baseUrl = authSession ? AUTH_API_BASE : API_BASE;
    const url = `${baseUrl}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}&depth=1`;

    try {
        const headers = {};
        if (authSession) {
            headers['Authorization'] = `Bearer ${authSession.accessJwt}`;
        }

        const res = await fetch(url, { headers });
        const data = await res.json();

        // Check if there are actually any replies
        if (!data.thread || !data.thread.replies || data.thread.replies.length === 0) {
            container.innerHTML = '<div class="no-replies">No replies yet. 🦗</div>';
            return;
        }

        let repliesHtml = '';
        
        // Loop through the replies and build the HTML
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

        // Inject the replies into the DOM
        container.innerHTML = repliesHtml;

    } catch (err) {
        console.error("Error loading replies:", err);
        container.innerHTML = '<div class="error-replies">Failed to load replies. ❌</div>';
    }
}