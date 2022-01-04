import React, { useContext, useState, useEffect } from 'react';
import dateformat from 'dateformat';

import { getRecords } from '../../utils';
import { WebContext } from '../../context/WebContext';
import SideColumn from '../sideColumn/sideColumn';
import { UserPageContext } from '../../context/UserPageContext';
import { History, ActionType, Page, QueryType, Post, Comment } from '../../constants';
import PostsList from '../postsList/postsList';
import CommentsList from '../postsList/commentsList';
import './userPage.scss';

type Props = {
    history: History,
    isReceived: boolean,
    data: any,
}

type Info = {
    who: string,
    action: string,
}

const ActivityWidget = ({ history, isReceived, data }: Props) => {
    const [date, setDate] = useState<string>(dateformat(new Date(history.time), "dd/mm/yyyy hh:MM TT"));
    const [info, setInfo] = useState<Info>(() => {
        if (history.action === ActionType.Post) {
            return {who: 'I (' + history.from + ')', action: 'created a post'}
        } else if (history.action === ActionType.Comment) {
            return {who: 'I (' + history.from + ')', action: 'commented on a post'}
        } else if (history.action === ActionType.UST) {
            return {who: 'UniRep Social', action: 'Epoch Rep drop'}
        } else {
            if (isReceived) {
                return {who: history.from, action: history.upvote > 0? 'boosted this post' : 'squashed this post'};
            } else {
                return {who: 'I (' + history.from + ')', action: history.upvote > 0? 'boosted this post' : 'squashed this post'};
            }
        }
    });

    return (
        <div className="activity-widget">
            <div className="main">
                <div className="header">
                    <p>{date}</p>
                    <div className="etherscan">Etherscan <img src="/images/etherscan.png" /></div>
                </div>
                <div className="who">
                    {info.who} <img src="/images/lighting.png" /> {info.action}
                </div>
            </div>
        </div>
    );
}

enum Tag {
    Posts = "Posts",
    Comments = "Comments",
    Activity = "Activity"
}

const UserPage = () => {
    const { isLoading, user, shownPosts } = useContext(WebContext);
    const [ histories, setHistories ] = useState<History[]>([]);
    const [ tag, setTag ] = useState<Tag>(Tag.Posts);
    const [ sort, setSort ] = useState<QueryType>(QueryType.Boost);
    const [ isDropdown, setIsDropdown ] = useState<boolean>(false);
    
    const [ myPosts, setMyPosts ] = useState<Post[]>(() =>{
        let posts: Post[] = [];
        for (var i = 0; i < shownPosts.length; i ++) {
            const p = shownPosts[i];
            console.log('this post is posted by ' + p.epoch_key + ', is author: ' + p.isAuthor);
            if (p.isAuthor) {
                posts = [...posts, p];
            }
        }
        return posts;
    });

    const [ myComments, setMyComments ] = useState<Comment[]>(() => {
        console.log('set my comments');
        let comments: Comment[] = [];
        for (var i = 0; i < shownPosts.length; i ++) {
            for (var j = 0; j < shownPosts[i].comments.length; j ++) {
                if (shownPosts[i].comments[j].isAuthor) {
                    comments = [...comments, shownPosts[i].comments[j]];
                }
            }
        }
        return comments;
    });

    const [ received, setReceived ] = useState<number[]>([0, 0, 0]); // airdrop, boost, squash
    const [ spent, setSpent ] = useState<number[]>([0, 0, 0, 0]); // post, comment, boost, squash

    const closeAll = () => {
        if (!isLoading) {}
    }

    useEffect (() => {
        
        const getHistory = async () => {
            console.log('get history');
            if (user !== null) {
                const ret = await getRecords(user.current_epoch, user.identity);
                setHistories(ret);
                let r: number[] = [0, 0, 0];
                let s: number[] = [0, 0, 0, 0];
                
                ret.forEach(h => {
                    const isReceived = user.all_epoch_keys.indexOf(h.from) === -1;
                    if (isReceived) {
                        // right stuff
                        if (h.action === ActionType.UST) {
                            r[0] += h.upvote;
                        } else if (h.action === ActionType.Vote) {
                            r[1] += h.upvote;
                            r[2] += h.downvote;
                        }
                    } else {
                        if (h.action === ActionType.Post) {
                            s[0] += h.downvote;
                        } else if (h.action === ActionType.Comment) {
                            s[1] += h.downvote;
                        } else if (h.action === ActionType.Vote) {
                            s[2] += h.upvote;
                            s[3] += h.downvote;
                        }
                    }
                });
                setReceived(r);
                setSpent(s);
                console.log(s);
            }
        }

        getHistory();

    }, []);

    const switchDropdown = () => {
        if (isDropdown) {
            setIsDropdown(false);
        } else {
            setIsDropdown(true);
        }
    }

    const setTagPage = (tag: Tag) => {
        setTag(tag);
        if (tag === Tag.Activity) {
            setSort(QueryType.New);
        } else {
            setSort(QueryType.Boost);
        }
    }

    const setSortType = (sort: QueryType) => {
        setSort(sort);
        setIsDropdown(false);
    }

    return (
        <div className="wrapper">
            <div className="default-gesture" onClick={closeAll}>
                {/* <UserPageContext.Provider value={{
                        page, switchPage: setPage, 
                        isPostFieldActive, setIsPostFieldActive}}>
                    <UserHeader histories={histories} setHistories={(histories: History[]) => setHistories(histories)}/>
                    { page === UserPageType.Posts? <UserPosts /> : page === UserPageType.History? <UserHistory histories={histories}/> : <div></div>}
                </UserPageContext.Provider> */}
                <div className="margin-box"></div>
                { user !== null? 
                    <div className="main-content">
                        <h3>My Stuff</h3> 
                        <div className="my-stuff">
                            <div className="my-reps stuff">
                                <div className="white-block">
                                    <p>My Reps</p>
                                    <div className="rep-info"><img src="/images/lighting-black.png" />{user.reputation}</div>
                                </div>
                                <div className="grey-block">
                                    <span>How I use my rep in this epoch</span><br/>
                                    <div className="rep-bar">
                                        { 
                                            spent.map((s, i) => <div className="rep-portion" style={{"width": `${s / user.reputation * 100}%`}} key={i}></div>)
                                        }
                                    </div>
                                </div>
                            </div>
                            <div style={{"width": "16px"}}></div>
                            <div className="received stuff">
                                <div className="grey-block">
                                    <p>Received</p>
                                    <div className="rep-received">{received[0] + received[1] - received[2]}</div>
                                    <span>These Reps are in the vault now, it will release to you in next epoch.</span>
                                </div>
                                <div className="white-block">
                                    <div className="received-info">
                                        <span><img src="/images/airdrop-white.png" />System drop</span>
                                        <p>+{received[0]}</p>
                                    </div>
                                    <div className="received-info">
                                        <span><img src="/images/boost-white.png" />Boost</span>
                                        <p>+{received[1]}</p>
                                    </div>
                                    <div className="received-info">
                                        <span><img src="/images/squash-white.png" />Squash</span>
                                        <p>-{received[2]}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="user-page-header">
                            <div className="tags">
                                <div className={tag === Tag.Posts? "tag underline" : "tag"} onClick={() => setTagPage(Tag.Posts)}>Posts</div>
                                <div className="line"></div>
                                <div className={tag === Tag.Comments? "tag underline" : "tag"} onClick={() => setTagPage(Tag.Comments)}>Comments</div>
                                <div className="line"></div>
                                <div className={tag === Tag.Activity? "tag underline" : "tag"} onClick={() => setTagPage(Tag.Activity)}>Activity</div>
                            </div>
                            <div className={isDropdown? "dropdown isDropdown" : "dropdown"} onClick={switchDropdown}>
                                {
                                    isDropdown? 
                                        tag !== Tag.Activity?
                                            <div>
                                                <div className="menu-choice" onClick={() => setSortType(QueryType.Boost)}><img src="/images/boost-fill.png"/>Boost</div>
                                                <div className="menu-choice" onClick={() => setSortType(QueryType.New)}><img src="/images/new-fill.png"/>New</div>
                                                <div className="menu-choice" onClick={() => setSortType(QueryType.Squash)}><img src="/images/squash-fill.png"/>Squash</div>
                                            </div> : 
                                            <div>
                                                <div className="menu-choice" onClick={() => setSortType(QueryType.New)}><img src="/images/new-fill.png"/>New</div>
                                                <div className="menu-choice" onClick={() => setSortType(QueryType.Rep)}><img src="/images/rep-fill.png"/>Rep</div>
                                            </div> :
                                        <div className="menu-choice isChosen">
                                            <img src={`/images/${sort}-fill.png`}/>
                                            <span>{sort.charAt(0).toUpperCase() + sort.slice(1)}</span>
                                            <img src="/images/selector-down.png" />
                                        </div>
                                }
                            </div>
                        </div> 
                        <div className="user-page-content">
                            {
                                tag === Tag.Posts? 
                                    <PostsList 
                                        posts={myPosts}
                                        timeFilter={10000000000}
                                        loadMorePosts={() => {}}
                                    /> : tag === Tag.Comments?
                                    <CommentsList 
                                        comments={myComments}
                                        page={Page.User}
                                        loadMoreComments={() => {}}
                                    /> : <div>
                                        {
                                            histories.map((h, i) => 
                                                <ActivityWidget 
                                                    key={i} 
                                                    history={h}
                                                    isReceived={user.all_epoch_keys.indexOf(h.from) === -1}
                                                    data={[]}
                                                />
                                            )
                                        }
                                    </div>
                            }   
                        </div>
                    </div> : <div></div> 
                }
                { user !== null? 
                    <div className="side-content">
                        <SideColumn page={Page.User} />
                    </div> : <div></div>
                }
                
                <div className="margin-box"></div>
            </div>
        </div>
    );
};

export default UserPage;