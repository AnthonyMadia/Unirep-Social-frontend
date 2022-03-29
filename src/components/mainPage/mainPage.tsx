import { useContext, useState, useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import { WebContext } from '../../context/WebContext'
import './mainPage.scss'
import PostContext from '../../context/Post'
import UserContext from '../../context/User'
import UnirepContext from '../../context/Unirep'

import { QueryType, AlertType } from '../../constants'
import BasicPage from '../basicPage/basicPage'
import PostsList from '../postsList/postsList'
import Feed from '../feed/feed'


const MainPage = () => {
    const history = useHistory()
    const posts = useContext(PostContext)
    const user = useContext(UserContext)
    const unirepConfig = useContext(UnirepContext)

    const { isLoading } = useContext(WebContext)

    const [query, setQuery] = useState<QueryType>(QueryType.New)

    const loadMorePosts = () => {
        console.log(
            'load more posts, now posts: ' + posts.feedsByQuery[query]?.length
        )
        const lastPost = [...posts.feedsByQuery[query]].pop()
        posts.loadFeed(query, lastPost?.id)
    }

    useEffect(() => {
        posts.loadFeed(query)
    }, [query])

    const gotoNewPost = () => {
        if (
            !isLoading &&
            user !== null &&
            user.reputation - user.spent >= unirepConfig.postReputation
        ) {
            history.push('/new', { isConfirmed: true })
        } else {
            console.log(user.id)
        }
    }

    return (
        <BasicPage>
            <div className="create-post" onClick={gotoNewPost}>
                {user.id === undefined
                    ? AlertType.postNotLogin
                    : user.reputation - user.spent < unirepConfig.postReputation
                    ? AlertType.postNotEnoughPoints
                    : 'Create post'}
            </div>
            <Feed feedChoice={query} setFeedChoice={setQuery} />
            <PostsList
                posts={posts.feedsByQuery[query] || []}
                loadMorePosts={loadMorePosts}
            />
        </BasicPage>
    )
}

export default observer(MainPage)
