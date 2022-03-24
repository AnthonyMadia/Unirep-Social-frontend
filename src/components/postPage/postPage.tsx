import { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { WebContext } from '../../context/WebContext'
import { Page, Params, Post } from '../../constants'
import PostBlock from '../postBlock/postBlock'
import BasicPage from '../basicPage/basicPage'
import { getPostById } from '../../utils'
import './postPage.scss'

const PostPage = () => {
    const { id } = useParams<Params>()
    const { shownPosts, setShownPosts } = useContext(WebContext)

    const setPost = async () => {
        let ret: any = null
        try {
            ret = await getPostById(id)
            setShownPosts([ret])
        } catch (e) {
            setShownPosts([])
        }
    }

    useEffect(() => {
        setPost()
    }, [])

    return (
        <BasicPage>
            {shownPosts.length === 0 ? (
                <div>No such post with id {id}.</div>
            ) : (
                <PostBlock post={shownPosts[0]} page={Page.Post} />
            )}
        </BasicPage>
    )
}

export default PostPage
