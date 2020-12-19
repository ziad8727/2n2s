# 2nodes2seconds
*Thanks to [2bored2wait](https://github.com/themoonisacheese/2bored2wait.git) for the inspiration*

This is a proxy service which simply waits out the queue and even keep you connected if you get disconnected for any reason.

# Installation
1. You'll need to install node.js (tested with v14.13.0, your mileage may vary)
2. `git clone` or download this repository and extract it to a directory.
3. Run `npm i`.
4. Edit the configuration file to your liking and then edit the secrets file to contain your credentials. If you are wary, **audit the sources** to make sure your credentials aren't being stolen.

# Usage
1. Run `node index`.
2. Navigate to your IP (or localhost) on the port you set (default 8090)
