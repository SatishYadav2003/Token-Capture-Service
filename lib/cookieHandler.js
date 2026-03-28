import raw_cookies from "../cookies.json" with {type: "json"};
export default function cookieHandler() {
    return raw_cookies.map(cookie => {
        let sameSite = cookie.sameSite;
        if (!sameSite) sameSite = "Lax";
        else {
            sameSite = sameSite.toLowerCase();
            if (sameSite === "no_restriction") sameSite = "None";
            else if (sameSite === "unspecified") sameSite = "Lax";
            else if (sameSite === "lax") sameSite = "Lax";
            else if (sameSite === "strict") sameSite = "Strict";
            else if (sameSite === "none") sameSite = "None";
            else sameSite = "Lax";
        }
        return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || "/",
            expires: cookie.expirationDate,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite,
        };
    });
}
