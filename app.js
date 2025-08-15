import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';

// Main App component for the portfolio blog
export default function App() {
    // --- State Management ---
    const [mainView, setMainView] = useState('home'); // 'home' or 'blog'
    const [blogView, setBlogView] = useState('public'); // 'public' or 'admin'
    const [posts, setPosts] = useState([]);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);
    const [newPost, setNewPost] = useState({ title: '', content: '' });
    const [editingPost, setEditingPost] = useState(null); // The post currently being edited
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [postToDelete, setPostToDelete] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for the mobile menu

    // Firestore and Auth instances
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);

    // --- Firebase Initialization and Authentication ---
    useEffect(() => {
        let firebaseApp, firebaseDb, firebaseAuth;
        try {
            const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            if (Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is not available. Please check your environment.");
                return;
            }

            firebaseApp = initializeApp(firebaseConfig);
            firebaseDb = getFirestore(firebaseApp);
            firebaseAuth = getAuth(firebaseApp);

            setDb(firebaseDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        const anonUser = await signInAnonymously(firebaseAuth);
                        setUserId(anonUser.user.uid);
                    } catch (error) {
                        console.error("Anonymous sign-in failed: ", error);
                    }
                }
                setIsAuthReady(true);
            });

            const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
            if (initialToken) {
                signInWithCustomToken(firebaseAuth, initialToken).catch(error => {
                    console.error("Custom token sign-in failed:", error);
                });
            }

            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
        }
    }, []);

    // --- Real-time Blog Posts Listener ---
    useEffect(() => {
        if (isAuthReady && userId && db) {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const postsCollectionPath = `artifacts/${appId}/users/${userId}/blogPosts`;
            const postsRef = collection(db, postsCollectionPath);

            const unsubscribe = onSnapshot(postsRef, (snapshot) => {
                const fetchedPosts = [];
                snapshot.forEach((doc) => {
                    fetchedPosts.push({ id: doc.id, ...doc.data() });
                });
                fetchedPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setPosts(fetchedPosts);
            }, (error) => {
                console.error("Failed to fetch blog posts: ", error);
            });

            return () => unsubscribe();
        }
    }, [isAuthReady, userId, db]);

    // --- CRUD Functions for Admin Panel ---
    const createPost = useCallback(async () => {
        if (!newPost.title || !newPost.content) {
            console.error("Title and content cannot be empty.");
            return;
        }

        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const postsCollectionPath = `artifacts/${appId}/users/${userId}/blogPosts`;
            await addDoc(collection(db, postsCollectionPath), {
                title: newPost.title,
                content: newPost.content,
                author: 'Murad Amin',
                timestamp: Date.now(),
            });
            setNewPost({ title: '', content: '' });
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    }, [newPost, userId, db]);

    const updatePost = useCallback(async (postId) => {
        if (!editingPost.title || !editingPost.content) {
            console.error("Title and content cannot be empty.");
            return;
        }
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const postsDocPath = `artifacts/${appId}/users/${userId}/blogPosts/${postId}`;
            await updateDoc(doc(db, postsDocPath), {
                title: editingPost.title,
                content: editingPost.content,
            });
            setEditingPost(null);
        } catch (error) {
            console.error("Error updating document: ", error);
        }
    }, [editingPost, userId, db]);

    const deletePost = useCallback(async () => {
        if (!postToDelete) return;
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const postsDocPath = `artifacts/${appId}/users/${userId}/blogPosts/${postToDelete.id}`;
            await deleteDoc(doc(db, postsDocPath));
            setShowDeleteModal(false);
            setPostToDelete(null);
        } catch (error) {
            console.error("Error deleting document: ", error);
        }
    }, [userId, db, postToDelete]);

    const showDeleteConfirmation = (post) => {
        setPostToDelete(post);
        setShowDeleteModal(true);
    };

    const CustomConfirmModal = ({ isOpen, onConfirm, onCancel, message }) => {
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-sm w-full mx-4">
                    <p className="text-xl font-bold text-white mb-4">{message}</p>
                    <div className="flex justify-end space-x-4">
                        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-300">
                            Cancel
                        </button>
                        <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-300">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- UI Rendering Functions ---
    const renderHomeView = () => (
        <div className="min-h-screen bg-gray-900 text-gray-300">
            {/* Hero Section */}
            <section id="hero" className="min-h-screen flex items-center justify-center relative">
                {/* Background image with parallax effect */}
                <div className="absolute inset-0 bg-cover bg-center bg-fixed" style={{ backgroundImage: `url('13.jpg')` }}></div>
                {/* Overlay to ensure text readability */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-black opacity-80"></div>
                <div className="text-center p-8 md:p-12 rounded-lg relative z-10">
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-md text-white">
                        Driving Digital Transformation with Innovative Solutions
                    </h1>
                    <p className="text-lg md:text-2xl mb-8 font-light max-w-2xl mx-auto text-gray-300">
                        A Web Developer & Python Software Engineer with a passion for
                        creating innovative solutions that align with organizational goals and foster sustainable growth.
                    </p>
                    <a href="#projects" className="px-6 py-3 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-300">
                        View My Projects
                    </a>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="py-20 bg-gray-800">
                <div className="container mx-auto px-6 flex flex-col md:flex-row items-center gap-12">
                    <div className="md:w-1/2">
                        <img src="13.jpg" alt="Murad Amin's photo" className="w-full rounded-full md:rounded-lg shadow-2xl" />
                    </div>
                    <div className="md:w-1/2 text-center md:text-left">
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">About Me</h2>
                        <p className="text-lg text-gray-300 mb-4">
                            Hello! My name is Murad Amin. I am a dynamic IT professional and a Computer Science Master's Candidate dedicated to driving digital transformation. With extensive experience in leadership roles, I specialize in IT and network administration, website management, and project management.
                        </p>
                        <p className="text-lg text-gray-300">
                            My skills in team leadership, strategic planning, and the implementation of IT policies contribute to improved governance and compliance. I am committed to delivering innovative solutions that align with organizational goals and foster sustainable growth.
                        </p>
                    </div>
                </div>
            </section>

            {/* Skills Section */}
            <section id="skills" className="py-20 bg-gray-900">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-white">Skills</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Web Development</h3>
                            <p className="text-gray-400">React, JavaScript, HTML5, CSS3, Tailwind CSS</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Backend & Databases</h3>
                            <p className="text-gray-400">Python, Firebase, Firestore, REST APIs</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">AI & Automation</h3>
                            <p className="text-gray-400">Generative UI, AI Assistants, AI Automation Agents</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">IT & Network Administration</h3>
                            <p className="text-gray-400">Network Administration, IT Governance, Cybersecurity</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Project Management</h3>
                            <p className="text-gray-400">Team Leadership, Strategic Planning, Agile Methodologies</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Soft Skills</h3>
                            <p className="text-gray-400">Problem-Solving, Communication, Continuous Learning</p>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Education and Certifications Section */}
            <section id="qualifications" className="py-20 bg-gray-800">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-white">Education & Certifications</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gray-700 p-6 rounded-lg shadow-xl">
                            <h3 className="text-3xl font-bold text-white mb-4">Education</h3>
                            <ul className="space-y-4 text-lg">
                                <li className="bg-gray-800 p-4 rounded-lg">
                                    <h4 className="font-bold text-white">Master's Candidate, Computer Science</h4>
                                    <p className="text-gray-400">Currently pursuing a Master's degree.</p>
                                </li>
                                <li className="bg-gray-800 p-4 rounded-lg">
                                    <h4 className="font-bold text-white">Bachelor's degree, Computer Science</h4>
                                    <p className="text-gray-400">Haramaya University (September 2015 - June 2018)</p>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-gray-700 p-6 rounded-lg shadow-xl">
                            <h3 className="text-3xl font-bold text-white mb-4">Certifications</h3>
                            <ul className="space-y-4 text-lg">
                                <li className="bg-gray-800 p-4 rounded-lg">
                                    <h4 className="font-bold text-white">Jira Fundamentals Badge</h4>
                                </li>
                                <li className="bg-gray-800 p-4 rounded-lg">
                                    <h4 className="font-bold text-white">Digital Networking Strategies</h4>
                                </li>
                                <li className="bg-gray-800 p-4 rounded-lg">
                                    <h4 className="font-bold text-white">Introduction to Cybersecurity</h4>
                                </li>
                                <li className="bg-gray-800 p-4 rounded-lg">
                                    <h4 className="font-bold text-white">Python Essentials 1</h4>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Projects Section */}
            <section id="projects" className="py-20 bg-gray-900">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-white">My Projects</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="project-item bg-gray-700 rounded-lg overflow-hidden shadow-xl">
                            <img src="https://placehold.co/800x600/161b22/c9d1d9?text=Web+Development" alt="Web Development Project" className="w-full h-auto object-cover" />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-white mb-2">Website Administration & Management</h3>
                                <p className="text-gray-400">Led the design, development, and maintenance of organizational websites, focusing on functionality and security.</p>
                            </div>
                        </div>
                        <div className="project-item bg-gray-700 rounded-lg overflow-hidden shadow-xl">
                            <img src="https://placehold.co/800x600/161b22/c9d1d9?text=AI+Automation" alt="AI Automation Project" className="w-full h-auto object-cover" />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-white mb-2">AI Automation & Personalized Assistants</h3>
                                <p className="text-gray-400">Explored and implemented solutions using Generative UI and AI to automate tasks and improve user experience.</p>
                            </div>
                        </div>
                        <div className="project-item bg-gray-700 rounded-lg overflow-hidden shadow-xl">
                            <img src="https://placehold.co/800x600/161b22/c9d1d9?text=Network+Infrastructure" alt="Network Administration Project" className="w-full h-auto object-cover" />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-white mb-2">Network Infrastructure & IT Governance</h3>
                                <p className="text-gray-400">Managed network infrastructure and implemented IT policies to enhance security, reliability, and compliance.</p>
                            </div>
                        </div>
                        <div className="project-item bg-gray-700 rounded-lg overflow-hidden shadow-xl">
                            <img src="https://placehold.co/800x600/161b22/c9d1d9?text=IT+Governance" alt="IT Governance Project" className="w-full h-auto object-cover" />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-white mb-2">Integrated IT Solutions & Policy Implementation</h3>
                                <p className="text-gray-400">Successfully led initiatives to implement robust IT policies, ensuring improved governance, security, and compliance across the organization.</p>
                            </div>
                        </div>
                        <div className="project-item bg-gray-700 rounded-lg overflow-hidden shadow-xl">
                            <img src="https://placehold.co/800x600/161b22/c9d1d9?text=Data+Analysis" alt="Data Science Project" className="w-full h-auto object-cover" />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-white mb-2">Data Analytics and Visualization Platform</h3>
                                <p className="text-gray-400">Designed and implemented data visualization dashboards using Python and various libraries to analyze key performance metrics and inform data-driven decisions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Recommendations Section */}
            <section id="recommendations" className="py-20 bg-gray-800">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-white">Recommendations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gray-700 p-8 rounded-lg shadow-xl relative">
                            <p className="text-lg italic text-gray-300 mb-6">"Murad is an exceptional leader in the IT space. His ability to manage complex projects, implement effective policies, and lead his team to success is truly impressive. He is a valuable asset to any organization."</p>
                            <div className="flex items-center">
                                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">JA</div>
                                <div>
                                    <p className="font-bold text-white">John A. Smith</p>
                                    <p className="text-gray-400">Former Supervisor</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-700 p-8 rounded-lg shadow-xl relative">
                            <p className="text-lg italic text-gray-300 mb-6">"Murad's expertise in network administration and his commitment to professional development are second to none. He is always at the forefront of new technologies and brings a strategic mindset to every challenge."</p>
                            <div className="flex items-center">
                                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">MD</div>
                                <div>
                                    <p className="font-bold text-white">Michael D. Johnson</p>
                                    <p className="text-gray-400">Team Member</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-20 bg-gray-900">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-12">Get in Touch</h2>
                    <div className="max-w-xl mx-auto bg-gray-700 p-8 rounded-lg shadow-xl">
                        <form className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-lg font-medium text-white mb-2">Name</label>
                                <input type="text" id="name" name="name" className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your Name" />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-lg font-medium text-white mb-2">Email</label>
                                <input type="email" id="email" name="email" className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="your.email@example.com" />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-lg font-medium text-white mb-2">Message</label>
                                <textarea id="message" name="message" rows="4" className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your message..."></textarea>
                            </div>
                            <button type="submit" className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-300">
                                Send Message
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );

    const renderBlogView = () => (
        <div className="min-h-screen bg-gray-900 text-gray-300">
            {/* Blog Navigation */}
            <header className="bg-gray-800 py-4 shadow-md">
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <span className="text-xl font-bold text-white">Blog</span>
                    <div className="space-x-4">
                        <button
                            onClick={() => setBlogView('public')}
                            className={`px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${blogView === 'public' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-blue-500'}`}
                        >
                            Public
                        </button>
                        <button
                            onClick={() => setBlogView('admin')}
                            className={`px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${blogView === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-blue-500'}`}
                        >
                            Admin
                        </button>
                    </div>
                </div>
            </header>
            
            {blogView === 'public' && (
                <div className="container mx-auto px-6 py-12">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-white">My Blog Posts</h2>
                    <div className="space-y-8">
                        {posts.length > 0 ? (
                            posts.map((post) => (
                                <div key={post.id} className="bg-gray-800 p-8 rounded-lg shadow-xl">
                                    <h3 className="text-3xl font-bold text-white mb-2">{post.title}</h3>
                                    <p className="text-gray-400 mb-4 text-sm">
                                        By {post.author} on {new Date(post.timestamp).toLocaleDateString()}
                                    </p>
                                    <p className="text-lg text-gray-300 whitespace-pre-wrap">{post.content}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400">No blog posts found.</p>
                        )}
                    </div>
                </div>
            )}

            {blogView === 'admin' && (
                <div className="container mx-auto px-6 py-12">
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-white">Admin Panel</h2>
                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-2xl mx-auto mb-12">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            {editingPost ? 'Edit Post' : 'Create New Post'}
                        </h3>
                        <input
                            type="text"
                            className="w-full px-4 py-2 mb-4 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Post Title"
                            value={editingPost ? editingPost.title : newPost.title}
                            onChange={(e) => editingPost ? setEditingPost({ ...editingPost, title: e.target.value }) : setNewPost({ ...newPost, title: e.target.value })}
                        />
                        <textarea
                            rows="6"
                            className="w-full px-4 py-2 mb-4 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Post Content"
                            value={editingPost ? editingPost.content : newPost.content}
                            onChange={(e) => editingPost ? setEditingPost({ ...editingPost, content: e.target.value }) : setNewPost({ ...newPost, content: e.target.value })}
                        />
                        {editingPost ? (
                            <div className="flex space-x-4">
                                <button
                                    onClick={() => updatePost(editingPost.id)}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-300"
                                >
                                    Update Post
                                </button>
                                <button
                                    onClick={() => setEditingPost(null)}
                                    className="flex-1 px-6 py-3 bg-gray-600 text-white font-bold rounded-lg shadow-lg hover:bg-gray-700 transition-colors duration-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={createPost}
                                className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-300"
                            >
                                Create Post
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-bold text-white mb-4">Existing Posts</h3>
                        {posts.length > 0 ? (
                            posts.map((post) => (
                                <div key={post.id} className="bg-gray-700 p-6 rounded-lg shadow-md flex justify-between items-center">
                                    <h4 className="text-xl font-bold text-white">{post.title}</h4>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setEditingPost(post)}
                                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors duration-300"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => showDeleteConfirmation(post)}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-300"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400">No blog posts to manage.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-300">
            {/* Main Navigation */}
            <header className="bg-gray-900 sticky top-0 z-50 shadow-lg">
                <nav className="container mx-auto px-6 py-4 flex justify-between items-center relative">
                    <span className="text-2xl font-bold text-white cursor-pointer" onClick={() => { setMainView('home'); setIsMobileMenuOpen(false); }}>Murad Amin's Portfolio</span>
                    
                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white focus:outline-none">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"}></path>
                            </svg>
                        </button>
                    </div>

                    {/* Desktop Menu & Mobile Drawer */}
                    <div className={`fixed inset-y-0 right-0 transform ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out bg-gray-800 p-6 w-64 md:relative md:w-auto md:bg-transparent md:flex md:transform-none md:space-x-4 md:space-y-0 md:p-0`}>
                        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0 md:justify-end">
                            <button
                                onClick={() => { setMainView('home'); setIsMobileMenuOpen(false); }}
                                className={`block md:inline-block px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${mainView === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-blue-500'}`}
                            >
                                Home
                            </button>
                            <a onClick={() => setIsMobileMenuOpen(false)} href="#about" className="block md:inline-block text-gray-300 hover:text-white transition-colors duration-300 px-4 py-2">About</a>
                            <a onClick={() => setIsMobileMenuOpen(false)} href="#skills" className="block md:inline-block text-gray-300 hover:text-white transition-colors duration-300 px-4 py-2">Skills</a>
                            <a onClick={() => setIsMobileMenuOpen(false)} href="#projects" className="block md:inline-block text-gray-300 hover:text-white transition-colors duration-300 px-4 py-2">Projects</a>
                            <button
                                onClick={() => { setMainView('blog'); setIsMobileMenuOpen(false); }}
                                className={`block md:inline-block px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${mainView === 'blog' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-blue-500'}`}
                            >
                                Blog
                            </button>
                        </div>
                    </div>
                </nav>
            </header>

            <main>
                {!isAuthReady ? (
                    <div className="flex justify-center items-center h-screen text-xl">
                        <p>Loading...</p>
                    </div>
                ) : (
                    <>
                        {mainView === 'home' && renderHomeView()}
                        {mainView === 'blog' && renderBlogView()}
                    </>
                )}
            </main>
            
            {/* Footer */}
            <footer className="bg-gray-950 text-gray-400 py-8">
                <div className="container mx-auto px-6 text-center">
                    <div className="flex justify-center space-x-6 mb-4">
                        <a href="https://www.linkedin.com/in/muradamin" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors duration-300">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-linkedin"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                        </a>
                        <a href="mailto:muradamen10@gmail.com" className="hover:text-white transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        </a>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Murad Amin. All Rights Reserved.</p>
                </div>
            </footer>
            
            <CustomConfirmModal
                isOpen={showDeleteModal}
                onConfirm={deletePost}
                onCancel={() => setShowDeleteModal(false)}
                message="Are you sure you want to delete this post? This action cannot be undone."
            />
        </div>
    );
}
