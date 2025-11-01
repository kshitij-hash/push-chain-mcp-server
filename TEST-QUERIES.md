# MCP Server Test Queries for LLM Agents

Use these queries with Claude, ChatGPT, or any LLM agent that has access to your Push Chain MCP server to verify all functionality is working correctly.

---

## 📚 Documentation Tools Testing

### Basic Documentation Queries

1. **List all documentation**
   ```
   Show me all available Push Chain documentation
   ```

2. **List by category**
   ```
   What tutorials are available in Push Chain?
   ```
   ```
   Show me all UI kit documentation
   ```
   ```
   List all deep-dive articles for Push Chain
   ```

3. **Search documentation**
   ```
   Find documentation about wallets
   ```
   ```
   Search for information about smart contracts in Push Chain
   ```
   ```
   What documentation exists about ERC-20 tokens?
   ```

4. **Get specific document**
   ```
   Show me the Push Chain introduction guide
   ```
   ```
   Get the wallet setup documentation
   ```

5. **Extract code examples**
   ```
   Show me all TypeScript code examples from the documentation
   ```
   ```
   Get Solidity code snippets from Push Chain docs
   ```
   ```
   What JavaScript examples are in the tutorials?
   ```

---

## 🔧 SDK Tools Testing

### API Discovery

6. **Find specific APIs**
   ```
   How do I use the PushClient in Push Chain?
   ```
   ```
   Show me the createUniversalSigner function
   ```
   ```
   What does the UniversalAccount class do?
   ```

7. **Search SDK**
   ```
   Search the SDK for wallet-related functions
   ```
   ```
   Find all transaction-related code in the Push Chain SDK
   ```
   ```
   What signing functionality exists in the SDK?
   ```

8. **Package information**
   ```
   What's in the @pushchain/core package?
   ```
   ```
   Show me details about the @pushchain/ui-kit package
   ```
   ```
   What are the dependencies of the core package?
   ```

9. **Type definitions**
   ```
   What fields does the UniversalAccount type have?
   ```
   ```
   Show me the SignerOptions interface
   ```
   ```
   What's the structure of the ChainConfig type?
   ```

10. **View source code**
    ```
    Show me the source code for PushClient
    ```
    ```
    Let me see the implementation of the universal signer
    ```

11. **List all exports**
    ```
    What functions are exported from @pushchain/core?
    ```
    ```
    List all classes in the Push Chain SDK
    ```
    ```
    Show me all TypeScript types available
    ```
    ```
    What interfaces are in the UI kit?
    ```

12. **Find usage examples**
    ```
    How is PushClient used in the codebase?
    ```
    ```
    Show me examples of createUniversalSigner usage
    ```
    ```
    Where is the connect function called?
    ```

13. **Get core classes**
    ```
    What are the main classes in Push Chain core?
    ```
    ```
    Show me all core SDK classes with their methods
    ```

14. **Get UI components**
    ```
    What React components are in the UI kit?
    ```
    ```
    List all React hooks available in Push Chain
    ```
    ```
    What UI providers does Push Chain offer?
    ```

---

## 🎯 Complex Multi-Step Queries

### Integration Scenarios

15. **Build a wallet**
    ```
    I want to build a wallet for Push Chain. Show me the relevant documentation and SDK functions I need.
    ```

16. **Implement signing**
    ```
    How do I implement transaction signing? Show me the types, functions, and example code.
    ```

17. **Setup a new project**
    ```
    I'm starting a new Push Chain project. What do I need to know? Show me setup guides and package info.
    ```

18. **Understand the architecture**
    ```
    Explain Push Chain's architecture. Show me the core classes, main types, and how they relate.
    ```

19. **Find specific functionality**
    ```
    I need to handle cross-chain transactions. Find all relevant documentation and SDK functions.
    ```

20. **Debug an issue**
    ```
    I'm getting an error with UniversalAccount. Show me the type definition, usage examples, and related documentation.
    ```

---

## 🔍 Edge Cases & Validation Testing

### Test Input Validation

21. **Empty/Invalid searches**
    ```
    Search for "xyz123nonexistent"
    ```
    ```
    Find documentation about "asdfjkl"
    ```

22. **Special characters**
    ```
    Search for documentation about "wallet-setup"
    ```
    ```
    Find code with "<script>" in it
    ```

23. **Large result sets**
    ```
    Show me all available documentation (should paginate)
    ```
    ```
    List all exports from all packages
    ```

24. **Case sensitivity**
    ```
    Find PUSHCLIENT function
    ```
    ```
    Search for pushclient (lowercase)
    ```

---

## 📊 Performance Testing

### Response Time Checks

25. **Quick queries** (should respond in <100ms)
    ```
    List documentation categories
    ```
    ```
    What packages are available?
    ```

26. **Medium queries** (should respond in <500ms)
    ```
    Search for "wallet"
    ```
    ```
    Show me PushClient API
    ```

27. **Large queries** (should handle well with truncation)
    ```
    Show me all documentation content
    ```
    ```
    List all source files with their code
    ```

---

## 🎨 Format Testing

### Different Response Formats

28. **Request JSON format**
    ```
    Show me wallet documentation in JSON format
    ```
    ```
    Search for "signer" and give me JSON results
    ```

29. **Request markdown format** (default)
    ```
    Show me the intro guide in markdown
    ```

30. **Code snippets**
    ```
    Show me just the code examples for creating a client
    ```

---

## 🔄 Pagination Testing

### Test Pagination

31. **Small limits**
    ```
    Show me the first 3 documentation files
    ```
    ```
    Search for "chain" but only show 5 results
    ```

32. **Default limits**
    ```
    List all available documentation
    ```

33. **Understand pagination**
    ```
    How do I see more results if there are too many?
    ```

---

## 🎓 Real-World Scenarios

### Actual Developer Workflows

34. **Getting started**
    ```
    I'm new to Push Chain. What should I read first?
    ```

35. **Building a dApp**
    ```
    I want to build a decentralized app on Push Chain. What tools and docs do I need?
    ```

36. **Understanding smart contracts**
    ```
    How do smart contracts work in Push Chain? Show me relevant docs and SDK functions.
    ```

37. **Wallet integration**
    ```
    How do I integrate wallet functionality into my app?
    ```

38. **Testing and debugging**
    ```
    What testing utilities does Push Chain provide?
    ```

39. **Deployment**
    ```
    How do I deploy a contract on Push Chain?
    ```

40. **Best practices**
    ```
    What are the best practices for developing on Push Chain?
    ```

---

## 🐛 Error Handling Testing

### Test Error Messages

41. **Non-existent API**
    ```
    Show me the NonExistentFunction API
    ```

42. **Non-existent doc**
    ```
    Get documentation for "fake-file-that-doesnt-exist.mdx"
    ```

43. **Invalid package**
    ```
    What's in the @pushchain/fake-package?
    ```

44. **Malformed requests**
    ```
    Search with no query term
    ```

---

## ✅ Expected Behaviors

### What to Verify:

For each query, check that:

1. **Response Time** - Should be fast (most < 200ms)
2. **Completeness** - Answers the question fully
3. **Accuracy** - Information is correct
4. **Format** - Clean, readable markdown or JSON
5. **Error Handling** - Invalid queries get helpful error messages
6. **Pagination** - Large results show pagination info
7. **No Crashes** - Server never crashes or hangs
8. **Character Limits** - Very long responses are truncated gracefully

---

## 🎯 Success Criteria

Your MCP server is working correctly if:

- ✅ All queries return results (or proper errors)
- ✅ Response times are fast
- ✅ Documentation search is accurate
- ✅ SDK search finds relevant code
- ✅ Code examples are properly formatted
- ✅ Error messages are helpful
- ✅ Pagination works for large results
- ✅ No server crashes or hangs
- ✅ Results are relevant to the query
- ✅ LLM can effectively use the information

---

## 📝 Testing Checklist

Use this checklist as you test:

- [ ] Basic documentation listing works
- [ ] Documentation search finds relevant files
- [ ] Code snippet extraction works
- [ ] SDK API lookup works
- [ ] SDK search finds functions/classes
- [ ] Package info is accurate
- [ ] Type definitions are complete
- [ ] Source code viewing works
- [ ] Usage examples are found
- [ ] Core classes listed correctly
- [ ] UI components listed correctly
- [ ] Multi-step queries work well
- [ ] Invalid queries handled gracefully
- [ ] Pagination shows for large results
- [ ] Performance is good (< 1 second for most queries)
- [ ] LLM understands and uses the responses effectively

---

## 🚀 Advanced Testing

### Stress Testing with LLM

45. **Rapid-fire queries**
    ```
    Ask 5 different questions in quick succession
    ```

46. **Complex combinations**
    ```
    Show me documentation about wallets, the WalletProvider component code, the Signer type definition, and usage examples of createWallet
    ```

47. **Context retention**
    ```
    First: "Show me the PushClient class"
    Then: "What methods does it have?"
    Then: "Show me an example of using the connect method"
    ```

48. **Comparison queries**
    ```
    What's the difference between UniversalAccount and StandardAccount?
    ```

49. **Discovery queries**
    ```
    I want to send tokens. What do I need to know?
    ```

50. **Troubleshooting**
    ```
    My transaction is failing. What could be wrong? Show me relevant error handling documentation.
    ```

---

## 🎓 Tips for Testing

1. **Start Simple** - Begin with basic queries to verify core functionality
2. **Increase Complexity** - Move to multi-step and complex queries
3. **Test Errors** - Try invalid inputs to verify error handling
4. **Mix Formats** - Request both JSON and markdown responses
5. **Performance Check** - Note which queries are slow
6. **LLM Understanding** - Verify the LLM can use the information effectively
7. **Real Scenarios** - Test actual developer workflows
8. **Edge Cases** - Try unusual or boundary inputs

---

## 📊 Sample Test Session

Here's a complete test session you can run:

```
Session 1: Basic Functionality (5 minutes)
1. "What documentation is available for Push Chain?"
2. "Search for wallet documentation"
3. "Show me the PushClient API"
4. "What's in the core package?"
5. "List all React components"

Session 2: Deep Dive (10 minutes)
6. "I want to build a wallet. Show me what I need."
7. "How do I sign transactions? Show code examples."
8. "What types do I need for account management?"
9. "Show me the complete PushClient implementation"
10. "Find all signing-related functions"

Session 3: Error & Edge Cases (5 minutes)
11. "Show me NonExistentAPI"
12. "Search for 'zzz123notreal'"
13. "List all documentation" (test pagination)
14. "Get package info for fake-package"

Session 4: Real Workflow (10 minutes)
15. "I'm new to Push Chain. Where should I start?"
16. "How do I set up a new project?"
17. "Explain the architecture"
18. "Show me testing utilities"
19. "How do I deploy a contract?"
20. "What are best practices?"
```

---

**Happy Testing! 🎉**

Your MCP server should handle all these queries efficiently and provide helpful, accurate responses to the LLM agent.
