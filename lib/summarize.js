/**
 * First line of an error message. Azure errors can run to many lines; the
 * full error is always kept as the `cause`.
 */
function summarize (error) {

    return String(error?.message ?? error).split(/\r?\n/)[0];

}

module.exports = summarize;
