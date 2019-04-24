Utilisation du plugin:

```javascript
export default {
	data() {
		return {
			user: null
		}
	},
	props: [
		'userUrl'
	],
	api {
		user () {
			return this.userUrl
		}
	}
}
```
