import { useContext, useEffect, useState } from 'react'
import dateformat from 'dateformat'
import { confirmAlert } from 'react-confirm-alert'
import 'react-confirm-alert/src/react-confirm-alert.css'

import { WebContext } from '../../context/WebContext'
import HelpWidget from '../helpWidget/helpWidget'
import { ActionType, InfoType } from '../../constants'
import UserContext from '../../context/User'
import { observer } from 'mobx-react-lite'
import EpochContext from '../../context/EpochManager'

const UserInfoWidget = () => {
    const epochManager = useContext(EpochContext)
    const userContext = useContext(UserContext)
    const { action, setAction, isLoading, setIsLoading } =
        useContext(WebContext)
    const [countdownText, setCountdownText] = useState<string>('')
    const [diffTime, setDiffTime] = useState<number>(0)
    const [isAlertOn, setAlertOn] = useState<boolean>(false)
    const nextUSTTimeString = dateformat(
        new Date(epochManager.nextTransition),
        'dd/mm/yyyy hh:MM TT'
    )

    const makeCountdownText = () => {
        const diff = (epochManager.nextTransition - Date.now()) / 1000
        setDiffTime(diff)

        if (epochManager.readyToTransition && userContext.userState) {
            if (action === null && !isAlertOn && !isLoading) {
                setAlertOn(true)
                confirmAlert({
                    closeOnClickOutside: true,
                    customUI: ({ onClose }) => {
                        return (
                            <div className="custom-ui">
                                <p>User State Transition</p>
                                <h2>It’s time to move on to the new cycle!</h2>
                                <button
                                    className="custom-btn"
                                    onClick={() => {
                                        const actionData = {
                                            identity: userContext.identity,
                                            userState: userContext.userState,
                                        }
                                        if (action === null && !isLoading) {
                                            setAction({
                                                action: ActionType.UST,
                                                data: actionData,
                                            })
                                        }
                                        setAlertOn(false)
                                        onClose()
                                    }}
                                >
                                    Let's go
                                </button>
                            </div>
                        )
                    },
                })
            }

            return 'Doing UST...'
        }
        const days = Math.floor(diff / (24 * 60 * 60))
        if (days > 0) {
            return days + ' days'
        }
        const hours = Math.floor(diff / (60 * 60))
        if (hours > 0) {
            return hours + ' hours'
        }
        const minutes = Math.floor(diff / 60)
        if (minutes > 0) {
            return minutes + ' minutes'
        }
        if (diff >= 0) {
            return Math.floor(diff) + ' seconds'
        }
        return 'Awaiting Epoch Change...'
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setCountdownText(makeCountdownText())
        }, 1000)

        return () => clearTimeout(timer)
    }, [diffTime])

    window.addEventListener('storage', (e) => {
        if (e.key === 'isLoading' && e.newValue === 'true') {
            setIsLoading(true)
        }
    })

    return (
        <div>
            {userContext.userState ? (
                <div className="user-info-widget widget">
                    <div className="rep-info">
                        <p>My Rep</p>
                        <h3>
                            <img
                                src={require('../../../public/images/lighting.svg')}
                            />
                            {userContext.reputation}
                        </h3>
                    </div>
                    <div className="ust-info">
                        <div className="block-title">
                            In this cycle, my personas are{' '}
                            <HelpWidget type={InfoType.persona} />
                        </div>
                        <div className="epks">
                            {userContext.currentEpochKeys.map((key) => (
                                <div className="epk" key={key}>
                                    {key}
                                </div>
                            ))}
                        </div>
                        <div className="margin"></div>
                        <div className="block-title">
                            Remaining time:{' '}
                            <HelpWidget type={InfoType.countdown} />
                        </div>
                        <div className="countdown">{countdownText}</div>
                        <div className="margin"></div>
                        <div className="block-title">Transition at:</div>
                        <div className="countdown small">
                            {nextUSTTimeString}
                        </div>
                    </div>
                </div>
            ) : (
                <div></div>
            )}
        </div>
    )
}

export default observer(UserInfoWidget)
