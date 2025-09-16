import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './App.css';

// --- API Configuration ---
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// --- Reusable Hooks ---
const useToasts = () => {
    const [toasts, setToasts] = useState([]);
    
    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);
    
    return { toasts, addToast };
};

const useLocalStorage = (key, defaultValue) => {
    const [value, setValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    });

    const setStoredValue = useCallback((newValue) => {
        try {
            setValue(newValue);
            window.localStorage.setItem(key, JSON.stringify(newValue));
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key]);

    return [value, setStoredValue];
};

// --- UI Components ---
const ToastContainer = ({ toasts }) => (
    <div className="toast-container">
        {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
                {toast.message}
            </div>
        ))}
    </div>
);

const Modal = ({ isOpen, onClose, children, title }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div 
                className="modal-content"
                onClick={e => e.stopPropagation()}
            >
                {title && (
                    <div className="p-6 border-b border-slate-700">
                        <h2 className="text-2xl font-bold text-center">{title}</h2>
                    </div>
                )}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const LoadingCard = () => (
    <div className="post-card">
        <div className="post-card-media skeleton"></div>
        <div className="post-card-content">
            <div className="h-6 skeleton rounded mb-2"></div>
            <div className="h-4 skeleton rounded w-3/4 mb-4"></div>
            <div className="h-4 skeleton rounded mb-2"></div>
            <div className="h-4 skeleton rounded w-2/3"></div>
        </div>
    </div>
);

// --- Main App Component ---
function App() {
    // State Management
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    
    // Modal States
    const [isPostModalOpen, setPostModalOpen] = useState(false);
    const [isReadModalOpen, setReadModalOpen] = useState(false);
    const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
    
    // Current Data
    const [currentPost, setCurrentPost] = useState(null);
    const [postIdToDelete, setPostIdToDelete] = useState(null);
    
    // Hooks
    const { toasts, addToast } = useToasts();
    const [likedPosts, setLikedPosts] = useLocalStorage('likedPosts', []);

    // Convert likedPosts to Set for better performance
    const likedPostsSet = useMemo(() => new Set(likedPosts), [likedPosts]);

    // Categories for filtering
    const categories = [
        { value: 'all', label: 'All', icon: 'fas fa-th-large' },
        { value: 'job notification', label: 'Jobs', icon: 'fas fa-briefcase' },
        { value: 'admit card', label: 'Admit Cards', icon: 'fas fa-id-card' },
        { value: 'result', label: 'Results', icon: 'fas fa-chart-line' }
    ];

    // API Functions
    const fetchPosts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/posts`);
            
            const postsData = response.data.success ? response.data.data : response.data;
            setPosts(Array.isArray(postsData) ? postsData : []);
        } catch (error) {
            console.error('Error fetching posts:', error);
            addToast("Could not fetch posts. Please try again later.", 'error');
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const handleFormSubmit = async (formData) => {
        try {
            const endpoint = currentPost 
                ? `${API_BASE_URL}/api/posts/${currentPost._id}` 
                : `${API_BASE_URL}/api/posts`;
            const method = currentPost ? 'put' : 'post';
            
            await axios[method](endpoint, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            
            await fetchPosts();
            setPostModalOpen(false);
            setCurrentPost(null);
            addToast(`Post ${currentPost ? 'updated' : 'created'} successfully!`, 'success');
        } catch (error) {
            console.error('Error saving post:', error);
            const errorMessage = error.response?.data?.message || 'Could not save post.';
            addToast(`Error: ${errorMessage}`, 'error');
        }
    };

    const handleDeleteConfirm = async () => {
        try {
            await axios.delete(`${API_BASE_URL}/api/posts/${postIdToDelete}`);
            setPosts(posts.filter(p => p._id !== postIdToDelete));
            setConfirmModalOpen(false);
            setPostIdToDelete(null);
            addToast('Post deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting post:', error);
            const errorMessage = error.response?.data?.message || 'Could not delete post.';
            addToast(`Error: ${errorMessage}`, 'error');
        }
    };
    
    const handleLike = async (postId) => {
        if (likedPostsSet.has(postId)) {
            addToast("You've already liked this post!", 'info');
            return;
        }
        
        // Optimistic update
        setPosts(prevPosts => prevPosts.map(p => 
            p._id === postId ? { ...p, likes: p.likes + 1 } : p
        ));
        setLikedPosts(prev => [...prev, postId]);
        
        try {
            await axios.post(`${API_BASE_URL}/api/posts/${postId}/like`);
        } catch (error) {
            // Revert optimistic update on error
            setPosts(prevPosts => prevPosts.map(p => 
                p._id === postId ? { ...p, likes: p.likes - 1 } : p
            ));
            setLikedPosts(prev => prev.filter(id => id !== postId));
            
            console.error('Error liking post:', error);
            addToast("Couldn't like post. Please try again.", 'error');
        }
    };
    
    const handleShare = async (postId, postTitle) => {
        const url = `${window.location.origin}/#post-${postId}`;
        
        try {
            if (navigator.share) {
                await navigator.share({
                    title: postTitle,
                    url: url
                });
                addToast('Shared successfully!', 'success');
            } else {
                await navigator.clipboard.writeText(url);
                addToast('Link copied to clipboard!', 'success');
            }
        } catch (error) {
            console.error('Error sharing:', error);
            addToast('Could not share. Please try again.', 'error');
        }
    };

    // Filtered posts with memoization
    const filteredPosts = useMemo(() => {
        return posts.filter(post => {
            const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                post.content.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = activeFilter === 'all' || 
                                post.category.toLowerCase() === activeFilter.toLowerCase();
            return matchesSearch && matchesFilter;
        });
    }, [posts, searchTerm, activeFilter]);

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <header className="text-center py-16 px-4">
                <h1 className="hero-title">
                    Jaswanth's Blog
                </h1>
                <p className="hero-subtitle max-w-3xl mx-auto">
                    Your automated source for the latest job notifications, results, and admit cards. 
                    Stay updated with government opportunities and career advancement resources.
                </p>
            </header>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Search and Filter */}
                <div className="search-container">
                    <div className="search-input-wrapper">
                        <i className="search-icon fas fa-search"></i>
                        <input 
                            type="text" 
                            placeholder="Search posts by title or content..." 
                            className="search-input" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    
                    <div className="filter-buttons">
                        {categories.map(({ value, label, icon }) => (
                            <button 
                                key={value} 
                                onClick={() => setActiveFilter(value)} 
                                className={`filter-btn ${activeFilter === value ? 'active' : ''}`}
                            >
                                <i className={`${icon} mr-2`}></i>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <main>
                    {loading ? (
                        <div className="posts-grid">
                            {Array(6).fill(0).map((_, i) => <LoadingCard key={i} />)}
                        </div>
                    ) : filteredPosts.length > 0 ? (
                        <div className="posts-grid">
                            {filteredPosts.map((post, i) => (
                                <PostCard 
                                    key={post._id} 
                                    post={post} 
                                    onLike={handleLike} 
                                    isLiked={likedPostsSet.has(post._id)} 
                                    onEdit={(p) => { 
                                        setCurrentPost(p); 
                                        setPostModalOpen(true); 
                                    }} 
                                    onDelete={(id) => { 
                                        setPostIdToDelete(id); 
                                        setConfirmModalOpen(true); 
                                    }} 
                                    onReadMore={(p) => { 
                                        setCurrentPost(p); 
                                        setReadModalOpen(true); 
                                    }} 
                                    onShare={() => handleShare(post._id, post.title)} 
                                    style={{ animationDelay: `${i * 100}ms` }} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <i className="fas fa-search"></i>
                            </div>
                            <h3 className="empty-title">No posts found</h3>
                            <p className="empty-message">
                                {searchTerm || activeFilter !== 'all' 
                                    ? 'Try adjusting your search or filter criteria' 
                                    : 'No posts have been published yet'}
                            </p>
                        </div>
                    )}
                </main>
            </div>
            
            {/* Floating Action Button */}
            <button 
                onClick={() => { 
                    setCurrentPost(null); 
                    setPostModalOpen(true); 
                }} 
                className="fab"
                title="Create New Post"
            >
                <i className="fas fa-plus"></i>
            </button>

            {/* Modals and Toasts */}
            <ToastContainer toasts={toasts} />
            
            <PostFormModal 
                isOpen={isPostModalOpen} 
                onClose={() => {
                    setPostModalOpen(false);
                    setCurrentPost(null);
                }} 
                post={currentPost} 
                onSubmit={handleFormSubmit} 
            />
            
            <ReadMoreModal 
                isOpen={isReadModalOpen} 
                onClose={() => {
                    setReadModalOpen(false);
                    setCurrentPost(null);
                }} 
                post={currentPost} 
            />
            
            <ConfirmModal 
                isOpen={isConfirmModalOpen} 
                onClose={() => {
                    setConfirmModalOpen(false);
                    setPostIdToDelete(null);
                }} 
                onConfirm={handleDeleteConfirm} 
            />
        </div>
    );
}

// --- Card & Modal Components ---
const PostCard = ({ post, onEdit, onDelete, onReadMore, onShare, onLike, isLiked, style }) => {
    const [imageError, setImageError] = useState(false);
    
    const truncatedContent = post.content.replace(/<[^>]*>/g, ''); // Strip HTML
    const excerpt = truncatedContent.length > 120 
        ? truncatedContent.substring(0, 120) + '...' 
        : truncatedContent;
    
    const formattedDate = new Date(post.createdAt).toLocaleDateString("en-US", { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    return (
        <article className="post-card" style={style}>
            {post.mediaUrl && !imageError && (
                <div className="post-card-media">
                    {post.mediaType?.startsWith('video') ? (
                        <video 
                            src={post.mediaUrl} 
                            className="w-full h-full object-cover" 
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <img 
                            src={post.mediaUrl} 
                            alt={post.title} 
                            className="w-full h-full object-cover" 
                            onError={() => setImageError(true)}
                        />
                    )}
                    
                    <div className="post-card-actions">
                        <button 
                            onClick={() => onEdit(post)} 
                            className="action-btn"
                            title="Edit Post"
                        >
                            <i className="fas fa-edit"></i>
                        </button>
                        <button 
                            onClick={() => onDelete(post._id)} 
                            className="action-btn delete"
                            title="Delete Post"
                        >
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            )}
            
            <div className="post-card-content">
                <h2 className="post-title">{post.title}</h2>
                
                <div className="post-meta">
                    <span className="category-badge">{post.category}</span>
                    <span className="post-date">{formattedDate}</span>
                    {post.views > 0 && (
                        <span className="post-date">
                            <i className="fas fa-eye mr-1"></i>
                            {post.views}
                        </span>
                    )}
                </div>
                
                <p className="post-excerpt">{excerpt}</p>
                
                <div className="post-card-footer">
                    <button 
                        onClick={() => onReadMore(post)} 
                        className="read-more-btn"
                    >
                        Read More <i className="fas fa-arrow-right ml-1"></i>
                    </button>
                    
                    <div className="post-actions">
                        <button 
                            onClick={() => onLike(post._id)} 
                            className={`like-btn ${isLiked ? 'liked' : ''}`}
                            disabled={isLiked}
                            title={isLiked ? "Already liked" : "Like post"}
                        >
                            <i className={`fas fa-heart ${isLiked ? 'text-red-500' : ''}`}></i>
                            <span>{post.likes}</span>
                        </button>
                        
                        <button 
                            onClick={onShare} 
                            className="share-btn"
                            title="Share post"
                        >
                            <i className="fas fa-share"></i>
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
};

const PostFormModal = ({ isOpen, onClose, post, onSubmit }) => {
    const [formData, setFormData] = useState({
        title: '',
        category: 'Job Notification',
        content: ''
    });
    const [mediaFile, setMediaFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: post?.title || '',
                category: post?.category || 'Job Notification',
                content: post?.content || ''
            });
            setMediaFile(null);
            setPreview(post?.mediaUrl || null);
        }
    }, [post, isOpen]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert('File size must be less than 10MB');
                return;
            }
            setMediaFile(file);
            setPreview(URL.createObjectURL(file));
        } else {
            setMediaFile(null);
            setPreview(post?.mediaUrl || null);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        const submitData = new FormData();
        submitData.append('title', formData.title.trim());
        submitData.append('category', formData.category);
        submitData.append('content', formData.content.trim());
        
        if (mediaFile) {
            submitData.append('mediaFile', mediaFile);
        }
        
        try {
            await onSubmit(submitData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const categories = ['Job Notification', 'Admit Card', 'Result'];

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            title={post ? 'Edit Post' : 'Create New Post'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {preview && (
                    <div className="mb-4">
                        {preview.includes('video') || mediaFile?.type?.startsWith('video') ? (
                            <video 
                                src={preview} 
                                className="w-full max-h-48 object-contain rounded-lg" 
                                controls
                            />
                        ) : (
                            <img 
                                src={preview} 
                                alt="Preview" 
                                className="w-full max-h-48 object-contain rounded-lg"
                            />
                        )}
                    </div>
                )}
                
                <div className="form-group">
                    <label className="form-label">Title *</label>
                    <input 
                        type="text" 
                        name="title"
                        value={formData.title} 
                        onChange={handleInputChange} 
                        className="form-input" 
                        required 
                        maxLength={200}
                        placeholder="Enter post title..."
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select 
                        name="category"
                        value={formData.category} 
                        onChange={handleInputChange} 
                        className="form-select" 
                        required
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                
                <div className="form-group">
                    <label className="form-label">Content (HTML supported) *</label>
                    <textarea 
                        name="content"
                        rows="8" 
                        value={formData.content} 
                        onChange={handleInputChange} 
                        className="form-textarea" 
                        required
                        placeholder="Enter post content. You can use HTML tags for formatting..."
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Media File</label>
                    <input 
                        type="file" 
                        onChange={handleFileChange} 
                        accept="image/*,video/*"
                        className="form-input" 
                    />
                    <p className="text-sm text-slate-400 mt-1">
                        Max file size: 10MB. Supported: Images and Videos
                    </p>
                </div>
                
                <div className="flex justify-end gap-4 pt-4">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="btn-secondary"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="spinner mr-2 w-4 h-4"></div>
                                {post ? 'Saving...' : 'Publishing...'}
                            </>
                        ) : (
                            post ? 'Save Changes' : 'Publish Post'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const ReadMoreModal = ({ isOpen, onClose, post }) => {
    if (!post) return null;
    
    const formattedDate = new Date(post.createdAt).toLocaleDateString("en-US", { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
        >
            <div className="max-h-[70vh] overflow-y-auto">
                {post.mediaUrl && (
                    <div className="mb-6">
                        {post.mediaType?.startsWith('video') ? (
                            <video 
                                src={post.mediaUrl} 
                                controls 
                                className="w-full rounded-lg"
                            />
                        ) : (
                            <img 
                                src={post.mediaUrl} 
                                alt={post.title} 
                                className="w-full rounded-lg" 
                            />
                        )}
                    </div>
                )}
                
                <div className="mb-4">
                    <span className="category-badge">{post.category}</span>
                    <p className="text-slate-400 text-sm mt-2">
                        Published on {formattedDate}
                        {post.views > 0 && ` • ${post.views} views`}
                    </p>
                </div>
                
                <h1 className="text-3xl font-bold mb-6 text-slate-100">{post.title}</h1>
                
                <div 
                    className="prose prose-invert max-w-none text-slate-300 leading-relaxed" 
                    dangerouslySetInnerHTML={{ __html: post.content }}
                />
                
                <div className="mt-8 pt-4 border-t border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-slate-400">
                        <span className="flex items-center gap-1">
                            <i className="fas fa-heart text-red-500"></i>
                            {post.likes} likes
                        </span>
                    </div>
                    
                    <button 
                        onClick={onClose} 
                        className="btn-secondary"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm }) => (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-2xl text-red-600"></i>
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-100">Delete Post</h3>
            <p className="mb-6 text-slate-300">
                Are you sure you want to delete this post? This action cannot be undone.
            </p>
            
            <div className="flex justify-center gap-4">
                <button 
                    onClick={onClose} 
                    className="btn-secondary"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm} 
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                    Delete Post
                </button>
            </div>
        </div>
    </Modal>
);

export default App;