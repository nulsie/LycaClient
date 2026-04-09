const AUTH_API_BASE = "https://bsky.social/xrpc";
let authSession = null; 
const API_BASE = "https://public.api.bsky.app/xrpc";


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

    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}


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
    if (currentHandle) fetchUserData(); 
}


const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && currentCursor && !isLoading) {
        fetchPosts(true); 
    }
}, { rootMargin: "100px" });

async function fetchUserData() {
    const handle = document.getElementById('handleInput').value.trim();
    if (!handle) return showToast("Type a handle, genius!");

    
    currentHandle = handle;
    currentCursor = null;
    document.getElementById('feed').innerHTML = ''; 
    
    try {
        
        const profileRes = await fetch(`${API_BASE}/app.bsky.actor.getProfile?actor=${handle}`);
        if (!profileRes.ok) throw new Error("User not found");
        
        currentProfile = await profileRes.json();
        
        
        await fetchPosts(false);
        
        
        const sentinel = document.getElementById('scrollSentinel');
        observer.observe(sentinel);
        
    } catch (err) {
        showToast(err.message);
        document.getElementById('profileCard').classList.add('hidden');
    }
}


async function fetchPosts(isPaginating = false) {
    if (!currentHandle) return;
    isLoading = true;
    
    const sentinel = document.getElementById('scrollSentinel');
    if (isPaginating) sentinel.classList.remove('hidden');

    
    const baseUrl = authSession ? AUTH_API_BASE : API_BASE;
    let url = `${baseUrl}/app.bsky.feed.getAuthorFeed?actor=${currentHandle}&limit=10`;
    
    if (currentCursor) {
        url += `&cursor=${currentCursor}`;
    }

    try {
        
        const headers = {};
        if (authSession) {
            headers['Authorization'] = `Bearer ${authSession.accessJwt}`;
        }

        const feedRes = await fetch(url, { headers });
        const feedData = await feedRes.json();

        
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

    
    verifiedBadge.classList.add('hidden');
    trustedBadge.classList.add('hidden');

    
    if (profile.verification) {
        if (profile.verification.verifiedStatus === 'valid') {
            verifiedBadge.classList.remove('hidden');
        }
        if (profile.verification.trustedVerifierStatus === 'valid') {
            trustedBadge.classList.remove('hidden');
        }
    } else if (profile.handle && !profile.handle.endsWith('.bsky.social')) {
        
        verifiedBadge.classList.remove('hidden');
    }

    const feedContainer = document.getElementById('feed');
    
    posts.forEach(item => {
        const postDiv = document.createElement('div');
        postDiv.className = 'post';

        
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


        let embedHtml = ''; 
        let videoDataToInit = null; 

        if (item.post.embed) {
            if (item.post.embed.$type === 'app.bsky.embed.images#view' || item.post.embed.images) {
                
                embedHtml = `<div class="post-gallery">`;
                item.post.embed.images.forEach(img => {
                    embedHtml += `<img src="${img.thumb}" class="post-img" alt="${img.alt || 'post image'}" onclick="openLightbox('${img.fullsize}')">`; 
                });
                embedHtml += `</div>`;
            } else if (item.post.embed.$type === 'app.bsky.embed.video#view') {
                
                const video = item.post.embed;
                const videoId = `bsky-video-${rkey}`;
                
                embedHtml = `
                    <div class="embed-card video-card">
                        <video id="${videoId}" class="post-video" controls poster="${video.thumbnail}" preload="none"></video>
                    </div>
                `;
                
                
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
    } 

    
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
    
    
    if (videoDataToInit) {
        const videoElement = document.getElementById(videoDataToInit.id);
        if (videoElement) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(videoDataToInit.playlist);
                hls.attachMedia(videoElement);
            }
            
            else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = videoDataToInit.playlist;
            }
        }
    }
  }); 
}



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


function toggleReplyBox(rkey) {
    const box = document.getElementById(`reply-container-${rkey}`);
    box.classList.toggle('hidden');
}


async function submitReply(parentUri, parentCid, rootUri, rootCid, rkey) {
    if (!authSession) return showToast("You must be logged in to reply.", "error");

    const inputEl = document.getElementById(`reply-input-${rkey}`);
    const text = inputEl.value.trim();

    if (!text) return showToast("Reply cannot be empty!", "error");

    try {
        
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


async function submitPost() {
    if (!authSession) return showToast("You must be logged in to post.", "error");

    const inputEl = document.getElementById('new-post-input');
    const text = inputEl.value.trim();

    if (!text) return showToast("Post cannot be empty!", "error");

    try {
        
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
 
async function parseFacets(text) {
    const facets = [];
    const encoder = new TextEncoder();

    
    const getByteStart = (index) => encoder.encode(text.substring(0, index)).byteLength;

    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        let uri = match[0];
        
        if (/[.,;!?]$/.test(uri)) uri = uri.slice(0, -1);
        
        const byteStart = getByteStart(match.index);
        const byteEnd = byteStart + encoder.encode(uri).byteLength;
        
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri }]
        });
    }

    
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

    
    const mentionRegex = /(?:^|\s)(@[a-zA-Z0-9.-]+)/g;
    while ((match = mentionRegex.exec(text)) !== null) {
        let mentionWithAt = match[1];
        mentionWithAt = mentionWithAt.replace(/[.,;!?]+$/, ''); 
        const handle = mentionWithAt.substring(1); 
        const matchIndex = match[0].indexOf(mentionWithAt) + match.index;
        
        const byteStart = getByteStart(matchIndex);
        const byteEnd = byteStart + encoder.encode(mentionWithAt).byteLength;
        
        try {
            
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
