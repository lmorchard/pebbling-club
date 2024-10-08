import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import { field, FormData, FormValidationError } from "../../utils/forms";
import partialBookmarkForm from "../partials/bookmarkForm";
import { UnfurlResult } from "../../../services/unfurl";
import { BookmarkWithPermissions } from "@/services/bookmarks";

export interface Props extends LayoutProps {
  formData?: FormData;
  unfurlResult?: UnfurlResult;
  existingBookmark?: BookmarkWithPermissions,
  validationError?: FormValidationError;
}

export default ({ formData, unfurlResult, existingBookmark, validationError, ...locals }: Props) => {
  const { csrfToken } = locals;
  const f = field({ formData, validationError });
  return layout({
    ...locals,
    title: "New Bookmark",
    content: html`
      <section>
        ${partialBookmarkForm({ csrfToken, formData, unfurlResult, existingBookmark, validationError })}
      </section>
    `,
  });
};
