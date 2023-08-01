import {
  ActionIcon,
  AppShell,
  Aside,
  Burger,
  Button,
  Footer,
  Global,
  Group,
  Header,
  MediaQuery,
  Navbar,
  Space,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createStyles, useMantineTheme } from "@mantine/styles";
import * as tauriEvent from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/api/process";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsMoonStarsFill } from "react-icons/bs";
import { ImCross } from "react-icons/im";
import { IoSunnySharp } from "react-icons/io5";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
// src imports
import LanguageHeaders from "./Components/LanguageHeaders";
import { ScrollToTop } from "./Components/ScrollToTop";
import { useTauriContext } from "./TauriProvider";
import {
  FOOTER,
  HEADER_TITLE,
  RUNNING_IN_TAURI,
  useLocalForage,
} from "./utils";
// imported views need to be added to the `views` list variable
import ExampleView from "./Views/ExampleView";
// fallback for React Suspense
import Fallback from "./Views/Fallback";
import { socket } from "./socket";
// import Home from './Views/Home';
// import About from './Views/About';
// import CIFInfo from './Views/CIFInfo';
// if your views are large, you can use lazy loading to reduce the initial load time
// const Settings = lazy(() => import('./Views/Settings'));

export default function () {
  const { t, i18n } = useTranslation();
  // check if using custom titlebar to adjust other components
  const { usingCustomTitleBar } = useTauriContext();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [recipient, setRecipient] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState({});
  const [isUserSelected, setIsUserSelected] = useState({});

  const initReactiveProperties = (user) => {
    user.hasNewMessages = false;
  };
  useEffect(() => {
    console.log("rerendered123");
    // void getTable();
    function onConnect() {
      console.log("user connected");
      setIsConnected(true);
      setIsLoggedIn(true);
      usersList.forEach((user) => {
        if (user.self) {
          user.connected = true;
        }
      });
    }

    function onDisconnect() {
      setIsConnected(false);
      usersList.forEach((user) => {
        if (user.self) {
          user.connected = false;
        }
      });
    }

    function onFooEvent(value) {
      setFooEvents((previous) => [...previous, value]);
    }
    socket.on("connect_error", (err) => {
      if (err.message === "invalid username") {
        setIsConnected(false);
      }
    });
    socket.on("user connected", (user) => {
      initReactiveProperties(user);
      setUsersList((previous) => [
        ...previous,
        { ...user, self: false, messages: [] },
      ]);
    });
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message", onFooEvent);
    socket.onAny((event, ...args) => {
      console.log(event, args[0]);
    });
    socket.on("users", (users) => {
      console.log("on users", users);
      const updatedUsers = users.map((user) => {
        return {
          ...user,
          self: user.userID === socket.id,
          messages: [],
        };
      });
      // put the current user first, and then sort by username
      updatedUsers.sort((a, b) => {
        if (a.self) return -1;
        if (b.self) return 1;
        if (a.username < b.username) return -1;
        return a.username > b.username ? 1 : 0;
      });
      setUsersList(updatedUsers);
    });
    socket.on("private message", ({ message, from }) => {
      const userIndex = usersList.findIndex((user) => user.userID === from);

      if (userIndex !== -1) {
        const updatedUsersList = usersList.map((user, index) => {
          if (index === userIndex) {
            const updatedMessages =
              user.messages.length > 0 ? user.messages : [];
            updatedMessages.push({
              message,
              fromSelf: false,
            });

            return {
              ...user,
              messages: updatedMessages,
              hasNewMessages: user.userID !== selectedUser.userID,
            };
          }

          return user;
        });

        setUsersList(updatedUsersList);
      }
    });
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message", onFooEvent);
      socket.off("connect_error");
      socket.off("user connected");
      socket.off("private message");
      socket.off("users");
    };
  }, [selectedUser.userID, usersList]);

  // left sidebar
  const views = [
    //     { component: () => <Home prop1={'stuff'} />, path: '/home', name: t('Home') },
    //     { component: CIFInfo, path: '/cif-info', name: 'CIF ' + t('Info') },
    //     { component: React.memo(About), path: '/about', name: t('About') },
    // Suspense example when a component was lazy loaded
    //     { component: () => <React.Suspense fallback={<Fallback />}><Setting /></React.Suspense>, path: '/settings', name: t('Settings') },
    { component: ExampleView, path: "/example-view", name: t("Online") },
  ];

  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  // opened is for mobile nav
  const [mobileNavOpened, setMobileNavOpened] = useState(false);
  // load preferences using localForage
  const [footersSeen, setFootersSeen, footersSeenLoading] = useLocalForage(
    "footersSeen",
    {}
  );

  // getAppStyles defined below App()
  const { classes } = getAppStyles();
  const [navbarClearance, setNavbarClearance] = useState(0);
  const footerRef = useRef(null);
  useEffect(() => {
    if (footerRef.current) setNavbarClearance(footerRef.current.clientHeight);
  }, [footersSeen]);

  // Updater integration

  function startInstall(newVersion) {
    notifications.show({
      title: t("Installing update v{{ v }}", { v: newVersion }),
      message: t("Will relaunch afterwards"),
      autoClose: false,
    });
    installUpdate().then(relaunch);
  }

  const mountID = useRef(null);
  const unlistens = useRef({});

  // Tauri event listeners (run on mount)
  if (RUNNING_IN_TAURI) {
    useEffect(() => {
      const thisMountID = Math.random();
      mountID.current = thisMountID;
      checkUpdate().then(({ shouldUpdate, manifest }) => {
        if (shouldUpdate) {
          const { version: newVersion, body: releaseNotes } = manifest;
          const color = colorScheme === "dark" ? "teal" : "teal.8";
          notifications.show({
            title: t("Update v{{ v }} available", { v: newVersion }),
            color,
            message: (
              <>
                <Text>{releaseNotes}</Text>
                <Button
                  color={color}
                  style={{ width: "100%" }}
                  onClick={() => startInstall(newVersion)}
                >
                  {t("Install update and relaunch")}
                </Button>
              </>
            ),
            autoClose: false,
          });
        }
      });
      // system tray
      tauriEvent
        .listen("systemTray", ({ payload, ...eventObj }) => {
          if (mountID.current != thisMountID) {
            unlistens.current[thisMountID]();
          } else {
            console.log(payload.message);
            // for debugging purposes only
            notifications.show({
              title: "[DEBUG] System Tray Event",
              message: payload.message,
            });
          }
        })
        .then((newUnlisten) => {
          unlistens.current[thisMountID] = newUnlisten;
        });
      return () => (mountID.current = null);
    }, []);
  }

  function UserList() {
    return (
      <React.Fragment>
        {usersList.map((user, index) => (
          <React.Fragment key={index}>
            {!user.self ? (
              <Button onClick={() => setIsUserSelected(user)} mt="sm">
                {user.username}
              </Button>
            ) : (
              <React.Fragment key={index}></React.Fragment>
            )}
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  }

  const showFooter = FOOTER && !footersSeenLoading && !(FOOTER in footersSeen);

  function FooterText() {
    // footer output logic goes here
    // example: parse JSON output from online source
    return t(FOOTER);
  }

  const scrollbar = useRef();
  const titlebarOverrides = (theme) => ({
    ".simplebar-vertical": {
      backgroundClip: "padding-box",
      marginTop: usingCustomTitleBar ? 100 : 70,
      marginBottom: showFooter ? 50 : 0,
    },
    body: {
      overflowY: "hidden",
    },
  });

  return (
    <>
      <Global styles={titlebarOverrides} />
      <SimpleBar
        scrollableNodeProps={{ ref: scrollbar }}
        autoHide={false}
        className={classes.simpleBar}
      >
        <AppShell
          padding="md"
          navbarOffsetBreakpoint="sm"
          navbar={
            <Navbar
              className={usingCustomTitleBar ? classes.titlebarMargin : ""}
              height="100%"
              width={{ sm: 200 }}
              p="xs"
              hidden={!mobileNavOpened}
              hiddenBreakpoint="sm"
            >
              <Navbar.Section grow>
                <UserList />
              </Navbar.Section>
              <Navbar.Section>
                {/* Bottom of Navbar Example: https://github.com/mantinedev/mantine/blob/master/src/mantine-demos/src/demos/core/AppShell/_user.tsx */}
                <Space h={navbarClearance} /> {/* Account for footer */}
              </Navbar.Section>
            </Navbar>
          }
          header={
            <Header
              data-tauri-drag-region
              height={70}
              p="md"
              className={
                `${classes.header} ` +
                (usingCustomTitleBar ? classes.headerOverrides : "")
              }
            >
              <MediaQuery largerThan="sm" styles={{ display: "none" }}>
                <Burger
                  opened={mobileNavOpened}
                  onClick={() => setMobileNavOpened((o) => !o)}
                  size="sm"
                  mr="xl"
                  color={useMantineTheme().colors.gray[6]}
                />
              </MediaQuery>
              <Text>{HEADER_TITLE}</Text>
              <Group className={classes.headerRightItems}>
                <LanguageHeaders i18n={i18n} />
                <ActionIcon
                  id="toggle-theme"
                  title="Ctrl + J"
                  className={classes.actionIcon}
                  variant="default"
                  onClick={() => toggleColorScheme()}
                  size={30}
                >
                  {/* icon to show based on colorScheme */}
                  {colorScheme === "dark" ? (
                    <IoSunnySharp size={"1.5em"} />
                  ) : (
                    <BsMoonStarsFill />
                  )}
                </ActionIcon>
              </Group>
            </Header>
          }
          aside={
            <MediaQuery smallerThan="sm" styles={{ display: "none" }}>
              <Aside
                className={usingCustomTitleBar ? classes.titlebarMargin : ""}
                p="md"
                hiddenBreakpoint="sm"
                width={{ sm: 200, lg: 300 }}
              >
                <Text>Right Side. Use for help or support menu?</Text>
              </Aside>
            </MediaQuery>
          }
          footer={
            showFooter && (
              <Footer height={"fit-content"} p="xs" className={classes.footer}>
                <FooterText />
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() =>
                    setFootersSeen((prev) => ({ ...prev, [FOOTER]: "" }))
                  }
                >
                  <ImCross />
                </Button>
              </Footer>
            )
          }
          className={classes.appShell}
        >
          {usingCustomTitleBar && <Space h="2em" />}
          <Routes>
            <Route exact path="/" element={<Navigate to={views[0].path} />} />
            {views.map((view, index) => (
              <Route
                key={index}
                exact={view.exact}
                path={view.path}
                element={
                  <view.component
                    setIsUserSelected={setIsUserSelected}
                    isUserSelected={isUserSelected}
                    usersList={usersList}
                    setUsersList={setUsersList}
                  />
                }
              />
            ))}
          </Routes>

          {/* prevent the footer from covering bottom text of a route view */}
          {showFooter && <Space h={80} />}
          <ScrollToTop
            scroller={scrollbar.current}
            bottom={showFooter ? 70 : 20}
          />
        </AppShell>
      </SimpleBar>
    </>
  );
}

// this can exported in styles.js
const getAppStyles = createStyles((theme) => ({
  simpleBar: {
    maxHeight: "100vh",
    marginRight: 6,
  },
  navLink: {
    display: "block",
    width: "100%",
    padding: theme.spacing.xs,
    borderRadius: theme.radius.md,
    color: theme.colorScheme === "dark" ? theme.colors.dark[0] : theme.black,
    textDecoration: "none",
    willChange: "transform",

    "&:hover:active": {
      transform: "translateY(2px)",
    },
  },
  navLinkActive: {
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.colors.dark[5]
        : theme.colors.gray[2],
  },
  navLinkInactive: {
    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[1],
    },
  },
  // overrides when using a custom titlebar
  titlebarMargin: {
    marginTop: "2em",
  },
  headerOverrides: {
    maxHeight: "calc(70px + 1em)",
    paddingBottom: "0 !important",
    marginTop: "1em",
  },
  header: {
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
  headerRightItems: {
    marginLeft: "auto",
  },
  appShell: {
    main: {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[8]
          : theme.colors.gray[0],
    },
  },
  mediaQuery: {
    display: "none",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
}));
