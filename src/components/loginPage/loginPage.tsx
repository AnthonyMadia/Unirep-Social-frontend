import { useHistory } from 'react-router-dom'
import { useContext, useState, useEffect } from 'react'

import './loginPage.scss'
import { WebContext } from '../../context/WebContext'
import LoadingCover from '../loadingCover/loadingCover'
import LoadingButton from '../loadingButton/loadingButton'
import UserContext from '../../context/User'

const LoginPage = () => {
    const history = useHistory()
    const { user, setUser, setNextUSTTime, isLoading, setIsLoading } =
        useContext(WebContext)
    const [input, setInput] = useState<string>('')
    const [errorMsg, setErrorMsg] = useState<string>('')
    const [isButtonLoading, setButtonLoading] = useState<boolean>(false)
    const userContext = useContext(UserContext)

    useEffect(() => {
        setErrorMsg('')
    }, [input])

    const handleInput = (event: any) => {
        setInput(event.target.value)
    }

    const login = async () => {
        setButtonLoading(true)
        const hasSignedUp = await userContext.hasSignedUp(input)
        setButtonLoading(false)

        if (!hasSignedUp) {
            setErrorMsg('Incorrect private key. Please try again.')
            return
        }
        setIsLoading(true)
        userContext.setIdentity(input)
        await userContext.waitForSync()
        const currentEpoch = await userContext.loadCurrentEpoch()

        if (userContext.userState?.latestTransitionedEpoch !== currentEpoch) {
            console.log(
                'user epoch is not the same as current epoch, do user state transition, ' +
                    userContext.userState?.latestTransitionedEpoch +
                    ' != ' +
                    currentEpoch
            )

            await userContext.userStateTransition()
        }
        await userContext.getAirdrop()
        setIsLoading(false)
        history.push('/')
    }

    return (
        <div className="login-page">
            <div className="left-column">
                <img
                    src={require('../../../public/images/unirep-title-white.svg')}
                />
            </div>
            <div className="right-column">
                <div className="close">
                    <img
                        id="unirep-icon"
                        src={require('../../../public/images/unirep-title.svg')}
                    />
                    <img
                        id="close-icon"
                        src={require('../../../public/images/close.svg')}
                        onClick={() => history.push('/')}
                    />
                </div>
                <div className="info">
                    <div className="title">Welcome back</div>
                    <p>
                        To enter the app, please use the private key you got
                        when you signed up.
                    </p>
                    <textarea
                        placeholder="enter your private key here."
                        onChange={handleInput}
                    />
                    {errorMsg.length === 0 ? (
                        <div></div>
                    ) : (
                        <div className="error">{errorMsg}</div>
                    )}
                    <div className="sign-in-btn" onClick={login}>
                        <LoadingButton
                            isLoading={isButtonLoading}
                            name="Sign in"
                        />
                    </div>
                    <div className="notification">
                        Lost your private key? Hummm... we can't help you to
                        recover it, that's a lesson learned for you. Want to
                        restart to earn rep points?{' '}
                        <a
                            target="_blank"
                            href="https://about.unirep.social/alpha-invitation"
                        >
                            Request an invitation code here.
                        </a>
                    </div>
                    <div className="go-to-signup">
                        Got an invitation code? <a href="/signup">Join here</a>
                    </div>
                </div>
            </div>
            {isLoading ? <LoadingCover /> : <div></div>}
        </div>
    )
}

export default LoginPage
